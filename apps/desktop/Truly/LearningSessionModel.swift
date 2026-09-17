import AppKit
import SwiftUI

@MainActor
final class LearningSessionModel: ObservableObject {
    private static let processorConsentKey = "truly.privacy.groq-screen-consent"
    private static let processorConsentRevision = "groq-learning-v2"
    @Published var selectedMode: LearningMode = .explain
    @Published var question = ""
    @Published var response = ""
    @Published var phase: LearningSessionPhase = .idle
    @Published var capturedScreen: NSImage?
    @Published var contextName = "Your learning workspace"
    @Published var screenPermissionGranted = false
    @Published var microphonePermission: MicrophonePermissionState = .notDetermined
    @Published var processorConsentGranted = false
    @Published var voiceState: VoiceInputState = .idle
    @Published var readRepliesAloud = UserDefaults.standard.bool(forKey: "truly.voice.read-replies")
    var allowsSpokenReplies = false
    @Published private(set) var activeLearningSession: DesktopLearningSession?
    private let captureService = ScreenCaptureService()
    private let voiceRecorder = VoiceRecorder()
    private let speechPlayback = SpeechPlaybackService()
    private let sessionToken: () -> String?
    private var captureGeneration = UUID()
    private var capturedDisplayFrame: CGRect?
    private var capturedFocus: CGPoint?
    private var voicePressed = false
    private var voiceTimeoutTask: Task<Void, Never>?
    private var voiceTask: Task<Void, Never>?
    var onResponseReady: ((CGFloat?, CGFloat?, CGRect, String) -> Void)?
    var onSpeechPlaybackChanged: ((Bool) -> Void)?

    init(sessionToken: @escaping () -> String? = { nil }) {
        self.sessionToken = sessionToken
        processorConsentGranted = UserDefaults.standard.string(forKey: Self.processorConsentKey)
            == Self.processorConsentRevision
        speechPlayback.onPlayingChanged = { [weak self] playing in self?.onSpeechPlaybackChanged?(playing) }
    }

    var canSubmit: Bool {
        activeLearningSession != nil && capturedScreen != nil &&
            !question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !phase.isBusy && !voiceState.isBusy
    }

    var canUseVoice: Bool {
        activeLearningSession != nil && capturedScreen != nil && processorConsentGranted && !phase.isBusy && !voiceState.isBusy
    }

    var activeSourceTitle: String { activeLearningSession?.source.title ?? "No Task or Path selected" }
    var activeStepTitle: String { activeLearningSession?.currentStep.title ?? "Start from Truly in Nimiq Pay" }

    func prepare() { refreshPermissions() }

    func refreshPermissions() {
        screenPermissionGranted = captureService.hasPermission
        microphonePermission = MicrophonePermissionService.state
    }

    func requestScreenPermission() {
        screenPermissionGranted = captureService.requestPermission()
        if !screenPermissionGranted {
            phase = .failed("Approve Screen Recording in System Settings, then restart Truly if macOS asks.")
        } else { phase = .idle }
    }

    func shareContext(at point: CGPoint, appName: String) async {
        resetSession()
        let generation = captureGeneration
        contextName = appName
        phase = .observing
        do {
            let capture = try await captureService.captureCurrentDisplay(at: point)
            guard generation == captureGeneration else { return }
            capturedScreen = capture.image
            capturedDisplayFrame = capture.displayFrame
            capturedFocus = CGPoint(
                x: min(1, max(0, (point.x - capture.displayFrame.minX) / capture.displayFrame.width)),
                y: min(1, max(0, (capture.displayFrame.maxY - point.y) / capture.displayFrame.height))
            )
            phase = .idle
        } catch {
            guard generation == captureGeneration else { return }
            phase = .failed(error.localizedDescription)
        }
        refreshPermissions()
    }

    func approveProcessor() {
        // Consent can be given in Settings before the first voice-invoked capture.
        guard activeLearningSession != nil else { return }
        processorConsentGranted = true
        UserDefaults.standard.set(Self.processorConsentRevision, forKey: Self.processorConsentKey)
        if case .failed = phase { phase = .idle }
    }

    func submitQuestion() {
        guard canSubmit else { return }
        guard processorConsentGranted else {
            phase = .failed("Turn on AI help before asking Truly.")
            return
        }
        guard let token = sessionToken() else {
            phase = .failed("Pair this Mac in Truly on your phone before asking for help.")
            return
        }
        guard let learningSession = activeLearningSession else {
            phase = .failed("Choose a Task or Path in Truly on your phone first.")
            return
        }
        guard let image = capturedScreen, let displayFrame = capturedDisplayFrame else { return }
        guard let jpeg = Self.boundedJPEG(from: image) else {
            phase = .failed("That screen is too large to share. Capture it again.")
            return
        }

        let generation = captureGeneration
        let request = LearningTurnBody(
            learningSessionId: learningSession.id,
            stepId: learningSession.currentStep.id,
            mode: selectedMode.rawValue.lowercased(),
            question: question.trimmingCharacters(in: .whitespacesAndNewlines),
            frame: .init(mimeType: "image/jpeg", base64: jpeg.base64EncodedString(),
                         focus: capturedFocus.map { .init(x: Double($0.x), y: Double($0.y)) }),
            consent: .init(processor: "groq", revision: Self.processorConsentRevision, approved: true)
        )
        phase = .responding
        response = ""
        Task {
            do {
                let turn = try await LearningTurnService().submit(request, token: token)
                guard generation == captureGeneration else { return }
                response = [turn.explanation, "Next: \(turn.nextAction)", turn.clarification]
                    .compactMap { $0 }.joined(separator: "\n\n")
                phase = .idle
                if readRepliesAloud && allowsSpokenReplies { speechPlayback.speak(response) }
                if let target = turn.target {
                    onResponseReady?(CGFloat(target.x), CGFloat(target.y), displayFrame, response)
                } else {
                    onResponseReady?(nil, nil, displayFrame, response)
                }
            } catch {
                guard generation == captureGeneration else { return }
                phase = .failed(error.localizedDescription)
            }
        }
    }

    func resetSession() {
        captureGeneration = UUID()
        question = ""
        response = ""
        capturedScreen = nil
        capturedDisplayFrame = nil
        capturedFocus = nil
        contextName = "Your learning workspace"
        phase = .idle
        cancelVoice()
        speechPlayback.stop()
    }

    private func cancelVoice() {
        voiceTask?.cancel()
        voiceTask = nil
        voiceRecorder.cancel()
        voiceTimeoutTask?.cancel()
        voiceTimeoutTask = nil
        voicePressed = false
        voiceState = .idle
    }

    func activateLearningSession(_ session: DesktopLearningSession?) {
        guard activeLearningSession?.id != session?.id || activeLearningSession?.currentStep != session?.currentStep else { return }
        activeLearningSession = session
        resetSession()
    }

    func revokeProcessorConsent() {
        // Invalidate pending answers as well as pending recordings/transcripts.
        captureGeneration = UUID()
        cancelVoice()
        speechPlayback.stop()
        phase = .idle
        processorConsentGranted = false
        UserDefaults.standard.removeObject(forKey: Self.processorConsentKey)
    }

    func beginVoice(automaticEnd: Bool = false) {
        guard canUseVoice, let _ = sessionToken() else { return }
        voicePressed = true
        voiceState = .requestingPermission
        speechPlayback.stop()
        let generation = captureGeneration
        voiceTask = Task {
            do {
                try await voiceRecorder.start { voicePressed && processorConsentGranted && generation == captureGeneration }
                guard !Task.isCancelled, generation == captureGeneration else { return }
                voiceState = .listening
                if !voicePressed { endVoice() }
                else {
                    voiceTimeoutTask?.cancel()
                    voiceTimeoutTask = Task {
                        let started = Date()
                        var lastSpeech: Date?
                        while !Task.isCancelled, voiceState == .listening, generation == captureGeneration {
                            let now = Date()
                            if automaticEnd, voiceRecorder.hasAudibleSpeech() { lastSpeech = now }
                            if automaticEnd, lastSpeech == nil, now.timeIntervalSince(started) >= 8 {
                                voiceRecorder.cancel()
                                voicePressed = false
                                voiceState = .failed("Truly did not hear a question. Try again, or type it instead.")
                                return
                            }
                            if now.timeIntervalSince(started) >= 30 ||
                                (automaticEnd && lastSpeech.map { now.timeIntervalSince($0) >= 1.6 } == true) {
                                endVoice(); return
                            }
                            try? await Task.sleep(for: .milliseconds(80))
                        }
                    }
                }
            } catch is CancellationError {
                guard generation == captureGeneration, !Task.isCancelled else { return }
                voiceState = .idle
                refreshPermissions()
            } catch {
                guard generation == captureGeneration, !Task.isCancelled else { return }
                voiceState = .failed(error.localizedDescription)
                refreshPermissions()
            }
        }
    }

    func endVoice() {
        voicePressed = false
        voiceTimeoutTask?.cancel()
        voiceTimeoutTask = nil
        guard voiceState == .listening else { return }
        guard processorConsentGranted, let token = sessionToken() else { cancelVoice(); return }
        let generation = captureGeneration
        do {
            let audio = try voiceRecorder.stop()
            voiceState = .transcribing
            voiceTask = Task {
                do {
                    let result = try await VoiceTranscriptionService().transcribe(audio, token: token)
                    guard !Task.isCancelled, generation == captureGeneration, processorConsentGranted,
                          sessionToken() == token else { return }
                    question = result.text
                    voiceState = .idle
                    if result.requiresReview {
                        voiceState = .failed("Check what Truly heard, then press Ask—or try saying it again.")
                    } else { submitQuestion() }
                } catch {
                    guard !Task.isCancelled, generation == captureGeneration else { return }
                    voiceState = .failed(error.localizedDescription)
                }
            }
        } catch {
            voiceState = .failed(error.localizedDescription)
        }
    }

    func setReadRepliesAloud(_ enabled: Bool) {
        readRepliesAloud = enabled
        UserDefaults.standard.set(enabled, forKey: "truly.voice.read-replies")
        if !enabled { speechPlayback.stop() }
    }

    private static func boundedJPEG(from image: NSImage) -> Data? {
        guard let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff) else { return nil }
        for quality in [0.72, 0.58, 0.44, 0.30] {
            if let data = bitmap.representation(using: .jpeg, properties: [.compressionFactor: quality]), data.count <= 1_048_576 {
                return data
            }
        }
        return nil
    }
}

private struct LearningTurnBody: Encodable {
    struct Frame: Encodable {
        struct Focus: Encodable { let x: Double; let y: Double }
        let mimeType: String
        let base64: String
        let focus: Focus?
    }
    struct Consent: Encodable { let processor: String; let revision: String; let approved: Bool }
    let learningSessionId: String
    let stepId: String
    let mode: String
    let question: String
    let frame: Frame
    let consent: Consent
}

private struct LearningTurnResponse: Decodable {
    struct Target: Decodable { let x: Double; let y: Double; let label: String? }
    let explanation: String
    let nextAction: String
    let clarification: String?
    let target: Target?
    let progressRecorded: Bool
}

private enum LearningTurnError: LocalizedError {
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: "Truly returned an unexpected answer. Your progress was not changed."
        case .server(let message): message
        }
    }
}

private struct LearningTurnService {
    private struct ProblemResponse: Decodable {
        struct Problem: Decodable { let message: String }
        let error: Problem
    }

    func submit(_ body: LearningTurnBody, token: String) async throws -> LearningTurnResponse {
        let configured = Bundle.main.object(forInfoDictionaryKey: "TRULY_CORE_URL") as? String
        guard let baseURL = URL(string: configured ?? "http://127.0.0.1:8787") else {
            throw LearningTurnError.server("Truly is not ready to connect yet.")
        }
        var request = URLRequest(url: baseURL.appending(path: "/v1/learning/turn"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        request.httpBody = try JSONEncoder().encode(body)
        request.timeoutInterval = 25

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw LearningTurnError.invalidResponse }
            guard (200..<300).contains(http.statusCode) else {
                let problem = try? JSONDecoder().decode(ProblemResponse.self, from: data)
                throw LearningTurnError.server(problem?.error.message ?? "Truly could not inspect this frame. Try again.")
            }
            let turn = try JSONDecoder().decode(LearningTurnResponse.self, from: data)
            guard turn.progressRecorded == false else { throw LearningTurnError.invalidResponse }
            return turn
        } catch let error as LearningTurnError {
            throw error
        } catch is DecodingError {
            throw LearningTurnError.invalidResponse
        } catch {
            throw LearningTurnError.server("Truly could not connect. Your progress was not changed; try again.")
        }
    }
}
