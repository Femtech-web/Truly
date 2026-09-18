import Foundation
import Security

enum TrulyCoreConfiguration {
    static let productionURL = URL(string: "https://app.usetruly.site")!

    static var baseURL: URL {
        guard let configured = Bundle.main.object(forInfoDictionaryKey: "TRULY_CORE_URL") as? String,
              let url = URL(string: configured.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.scheme == "https" || url.scheme == "http" else {
            return productionURL
        }
        return url
    }

    static var isLocal: Bool {
        ["localhost", "127.0.0.1", "::1", "[::1]"].contains(baseURL.host ?? "")
    }

    static var displayName: String {
        isLocal ? "Local development Core · \(baseURL.host ?? "localhost")" : "Production Core · \(baseURL.host ?? "app.usetruly.site")"
    }
}

@MainActor
final class DevicePairingModel: ObservableObject {
    enum LearningSessionChange: Equatable {
        case restored
        case updated
    }

    enum State: Equatable {
        case idle
        case creating
        case waiting
        case paired
        case failed(String)

        var label: String {
            switch self {
            case .idle: "Not paired"
            case .creating: "Getting ready"
            case .waiting: "Waiting for your phone"
            case .paired: "Mac paired"
            case .failed: "Needs attention"
            }
        }
    }

    @Published private(set) var state: State = .idle
    @Published private(set) var pairingCode: String?
    @Published private(set) var expiresAt: Date?
    @Published private(set) var walletAddress: String?
    @Published private(set) var coreUnavailable = false
    @Published private(set) var activeLearningSession: DesktopLearningSession?

    var hasStoredSession: Bool { KeychainStore.string(for: .desktopSession) != nil }
    var desktopSessionToken: String? { KeychainStore.string(for: .desktopSession) }
    var isLocalCore: Bool { service.isLocal }
    var coreEnvironmentLabel: String { TrulyCoreConfiguration.displayName }

    private let service = PairingService()
    private var pollingTask: Task<Void, Never>?
    private var monitoringTask: Task<Void, Never>?
    private var learningTask: Task<Void, Never>?
    private var hasFetchedLearningSession = false
    private var activeChallenge: PairingChallenge?
    var onRevoked: (() -> Void)?
    var onLearningSessionChanged: ((DesktopLearningSession?, LearningSessionChange) -> Void)?

    init() {
        if let token = KeychainStore.string(for: .desktopSession) {
            state = .creating
            startMonitoring(token: token)
        }
    }

    func retryConnection() {
        if let token = KeychainStore.string(for: .desktopSession) {
            state = .creating
            coreUnavailable = false
            startMonitoring(token: token)
        } else {
            createCode()
        }
    }

    func createCode() {
        pollingTask?.cancel()
        cancelActiveChallenge()
        stopMonitoring()
        state = .creating
        coreUnavailable = false
        pairingCode = nil
        expiresAt = nil

        pollingTask = Task {
            do {
                let challenge = try await service.createChallenge()
                guard !Task.isCancelled else {
                    try? await service.cancel(challenge)
                    return
                }
                activeChallenge = challenge
                pairingCode = challenge.code
                expiresAt = challenge.expiresAt
                state = .waiting
                await poll(challenge)
            } catch {
                guard !Task.isCancelled else { return }
                coreUnavailable = Self.isConnectionFailure(error)
                state = .failed(error.localizedDescription)
            }
        }
    }

    func reset() {
        pollingTask?.cancel()
        pollingTask = nil
        cancelActiveChallenge()
        pairingCode = nil
        expiresAt = nil
        state = walletAddress == nil ? .idle : .paired
        if let token = KeychainStore.string(for: .desktopSession) { startMonitoring(token: token) }
    }

    func stopMonitoring() {
        monitoringTask?.cancel(); monitoringTask = nil
        learningTask?.cancel(); learningTask = nil
        hasFetchedLearningSession = false
    }

    private func startMonitoring(token: String) {
        stopMonitoring()
        monitoringTask = Task {
            while !Task.isCancelled {
                do {
                    let session = try await service.validateSession(token: token)
                    guard !Task.isCancelled else { return }
                    walletAddress = session.walletAddress
                    coreUnavailable = false
                    state = .paired
                    startLearningMonitoring(token: token)
                } catch {
                    guard !Task.isCancelled else { return }
                    coreUnavailable = Self.isConnectionFailure(error)
                    if case PairingServiceError.server(let status, _) = error, status == 401 {
                        KeychainStore.remove(.desktopSession)
                        KeychainStore.remove(.walletAddress)
                        walletAddress = nil
                        updateLearningSession(nil)
                        state = .failed("This Mac’s access expired or was revoked. Pair it again from Nimiq Pay.")
                        onRevoked?()
                        return
                    }
                    state = .failed(error.localizedDescription)
                }
                try? await Task.sleep(for: .seconds(15))
            }
        }
    }

    private func startLearningMonitoring(token: String) {
        if learningTask != nil { return }
        learningTask = Task {
            while !Task.isCancelled {
                do {
                    let session = try await service.activeLearningSession(token: token)
                    guard !Task.isCancelled else { return }
                    updateLearningSession(session)
                } catch PairingServiceError.server(let status, _) where status == 401 {
                    KeychainStore.remove(.desktopSession)
                    KeychainStore.remove(.walletAddress)
                    walletAddress = nil
                    updateLearningSession(nil)
                    state = .failed("This Mac’s access expired or was revoked. Pair it again from Nimiq Pay.")
                    onRevoked?()
                    return
                } catch {
                    // Session validation owns the visible connectivity state. Keep the last known
                    // learning session during a transient handoff-poll failure.
                }
                try? await Task.sleep(for: .seconds(3))
            }
        }
    }

    private func updateLearningSession(_ session: DesktopLearningSession?) {
        let change: LearningSessionChange = hasFetchedLearningSession ? .updated : .restored
        hasFetchedLearningSession = true
        guard activeLearningSession != session else { return }
        activeLearningSession = session
        onLearningSessionChanged?(session, change)
    }

    private func cancelActiveChallenge() {
        guard let challenge = activeChallenge else { return }
        activeChallenge = nil
        Task { try? await service.cancel(challenge) }
    }

    private static func isConnectionFailure(_ error: Error) -> Bool {
        if case PairingServiceError.server(let status, _) = error { return status == 0 }
        return false
    }

    private func poll(_ challenge: PairingChallenge) async {
        while !Task.isCancelled && Date() < challenge.expiresAt {
            do {
                let result = try await service.exchange(challenge)
                guard !Task.isCancelled else { return }
                if case .paired(let session) = result {
                    try KeychainStore.save(session.token, for: .desktopSession)
                    try KeychainStore.save(session.walletAddress, for: .walletAddress)
                    walletAddress = session.walletAddress
                    pairingCode = nil
                    expiresAt = nil
                    activeChallenge = nil
                    state = .paired
                    startMonitoring(token: session.token)
                    return
                }
            } catch PairingServiceError.server(let status, _) where status == 429 {
                try? await Task.sleep(for: .seconds(60))
            } catch let error as PairingServiceError where error.isTerminal == false {
                // A transient request failure is retried until the short challenge expires.
            } catch {
                state = .failed(error.localizedDescription)
                return
            }

            try? await Task.sleep(for: .seconds(2))
        }

        guard !Task.isCancelled else { return }
        pairingCode = nil
        expiresAt = nil
        state = .failed("That code expired. Create a new code and try again.")
    }
}

private struct PairingChallenge: Sendable {
    let id: String
    let code: String
    let exchangeSecret: String
    let expiresAt: Date
}

private enum PairingExchangeResult: Sendable {
    case pending
    case paired(PairedDesktopSession)
}

private struct PairedDesktopSession: Sendable {
    let token: String
    let walletAddress: String
}

private enum PairingServiceError: LocalizedError {
    case configuration
    case invalidResponse
    case server(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .configuration:
            "Truly is not ready to connect yet."
        case .invalidResponse:
            "Truly returned an unexpected response. Please try again."
        case .server(_, let message):
            message
        }
    }

    var isTerminal: Bool {
        switch self {
        case .server(let status, _): status >= 400 && status < 500 && status != 429
        case .configuration, .invalidResponse: true
        }
    }
}

private struct PairingService {
    var isLocal: Bool { TrulyCoreConfiguration.isLocal }

    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let value = try decoder.singleValueContainer().decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: value) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: value) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Invalid ISO-8601 date"))
        }
        return decoder
    }()

    func validateSession(token: String) async throws -> DesktopSessionResponse {
        let url = baseURL.appending(path: "/v1/desktop/session")
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        request.timeoutInterval = 8
        return try await perform(request)
    }

    func activeLearningSession(token: String) async throws -> DesktopLearningSession? {
        let url = baseURL.appending(path: "/v1/desktop/learning-session")
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        request.timeoutInterval = 8
        let response: DesktopLearningSessionResponse = try await perform(request)
        return response.session
    }

    func createChallenge() async throws -> PairingChallenge {
        let request = try request(path: "/v1/pairing/challenges", body: CreatePairingBody(
            installId: installID,
            deviceName: Host.current().localizedName ?? "This Mac",
            platform: "macOS"
        ))
        let response: CreatePairingResponse = try await perform(request)
        return PairingChallenge(
            id: response.challengeId,
            code: response.code,
            exchangeSecret: response.exchangeSecret,
            expiresAt: response.expiresAt
        )
    }

    func cancel(_ challenge: PairingChallenge) async throws {
        let request = try request(path: "/v1/pairing/challenges/\(challenge.id)/cancel",
                                  body: ExchangePairingBody(exchangeSecret: challenge.exchangeSecret))
        let _: CancelPairingResponse = try await perform(request)
    }

    func exchange(_ challenge: PairingChallenge) async throws -> PairingExchangeResult {
        let request = try request(
            path: "/v1/pairing/challenges/\(challenge.id)/exchange",
            body: ExchangePairingBody(exchangeSecret: challenge.exchangeSecret)
        )
        let response: ExchangePairingResponse = try await perform(request)
        if response.status == "pending" { return .pending }
        guard let token = response.token, let walletAddress = response.walletAddress else {
            throw PairingServiceError.invalidResponse
        }
        return .paired(PairedDesktopSession(token: token, walletAddress: walletAddress))
    }

    private var baseURL: URL { TrulyCoreConfiguration.baseURL }

    private var installID: String {
        let key = "truly.device.install-id"
        if let value = UserDefaults.standard.string(forKey: key) { return value }
        let value = UUID().uuidString.lowercased()
        UserDefaults.standard.set(value, forKey: key)
        return value
    }

    private func request<T: Encodable>(path: String, body: T) throws -> URLRequest {
        let url = baseURL.appending(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try JSONEncoder().encode(body)
        request.timeoutInterval = 8
        return request
    }

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw PairingServiceError.invalidResponse
            }
            guard (200..<300).contains(httpResponse.statusCode) else {
                let problem = try? decoder.decode(ProblemResponse.self, from: data)
                throw PairingServiceError.server(
                    status: httpResponse.statusCode,
                    message: problem?.error.message ?? "Truly could not pair this Mac. Please try again."
                )
            }
            return try decoder.decode(T.self, from: data)
        } catch let error as PairingServiceError {
            throw error
        } catch let error as DecodingError {
            _ = error
            throw PairingServiceError.invalidResponse
        } catch {
            throw PairingServiceError.server(status: 0, message: "Truly could not connect. Check your connection, then try again.")
        }
    }
}

private struct CreatePairingBody: Encodable {
    let installId: String
    let deviceName: String
    let platform: String
}

private struct CancelPairingResponse: Decodable { let status: String }

private struct DesktopSessionResponse: Decodable {
    let walletAddress: String
}

private struct DesktopLearningSessionResponse: Decodable {
    let session: DesktopLearningSession?
}

private struct CreatePairingResponse: Decodable {
    let challengeId: String
    let code: String
    let exchangeSecret: String
    let expiresAt: Date
}

private struct ExchangePairingBody: Encodable {
    let exchangeSecret: String
}

private struct ExchangePairingResponse: Decodable {
    let status: String
    let token: String?
    let walletAddress: String?
}

private struct ProblemResponse: Decodable {
    struct Problem: Decodable { let message: String }
    let error: Problem
}

private enum KeychainStore {
    enum Key: String {
        case desktopSession = "desktop-session"
        case walletAddress = "wallet-address"
    }

    static func string(for key: Key) -> String? {
        var query = baseQuery(for: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func save(_ value: String, for key: Key) throws {
        let data = Data(value.utf8)
        let query = baseQuery(for: key)
        let attributes = [kSecValueData as String: data]
        let status: OSStatus

        if SecItemCopyMatching(query as CFDictionary, nil) == errSecSuccess {
            status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        } else {
            var insert = query
            insert[kSecValueData as String] = data
            status = SecItemAdd(insert as CFDictionary, nil)
        }

        guard status == errSecSuccess else {
            throw PairingServiceError.server(status: Int(status), message: "Truly could not save this connection securely. Please try again.")
        }
    }

    static func remove(_ key: Key) { SecItemDelete(baseQuery(for: key) as CFDictionary) }

    private static func baseQuery(for key: Key) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.femtech.truly",
            kSecAttrAccount as String: key.rawValue,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
    }
}
