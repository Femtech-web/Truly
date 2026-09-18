import AVFoundation
import Foundation

enum VoiceInputState: Equatable {
    case idle
    case requestingPermission
    case listening
    case transcribing
    case failed(String)

    var isBusy: Bool { self == .requestingPermission || self == .listening || self == .transcribing }
}

@MainActor
final class VoiceRecorder {
    private var recorder: AVAudioRecorder?
    private var recordingURL: URL?
    private let files = FileManager()

    func start(whileRequested: () -> Bool) async throws {
        let allowed: Bool
        switch MicrophonePermissionService.state {
        case .granted: allowed = true
        case .notDetermined: allowed = await MicrophonePermissionService.requestPermission()
        case .denied: allowed = false
        }
        guard allowed else { throw VoiceError.permissionDenied }
        try Task.checkCancellation()
        guard whileRequested() else { throw CancellationError() }
        let url = files.temporaryDirectory.appending(path: "truly-voice-\(UUID().uuidString).m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 16_000,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
        ]
        recordingURL = url
        let recorder: AVAudioRecorder
        do { recorder = try AVAudioRecorder(url: url, settings: settings) }
        catch { cancel(); throw VoiceError.recordingFailed }
        recorder.prepareToRecord()
        recorder.isMeteringEnabled = true
        guard recorder.record() else { cancel(); throw VoiceError.recordingFailed }
        self.recorder = recorder
    }

    func stop() throws -> Data {
        let duration = recorder?.currentTime ?? 0
        recorder?.stop()
        recorder = nil
        guard let url = recordingURL else { throw VoiceError.recordingFailed }
        recordingURL = nil
        defer { try? files.removeItem(at: url) }
        guard duration >= 0.35 else { throw VoiceError.tooShort }
        let data = try Data(contentsOf: url, options: .mappedIfSafe)
        guard data.count >= 32, data.count <= 5 * 1024 * 1024 else { throw VoiceError.recordingFailed }
        return data
    }

    func cancel() {
        recorder?.stop()
        recorder = nil
        if let recordingURL { try? files.removeItem(at: recordingURL) }
        recordingURL = nil
    }

    func hasAudibleSpeech() -> Bool {
        guard let recorder else { return false }
        recorder.updateMeters()
        return recorder.averagePower(forChannel: 0) > -42
    }
}

enum VoiceError: LocalizedError {
    case permissionDenied
    case recordingFailed
    case tooShort
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .permissionDenied: "Allow Microphone access in System Settings, then choose Record a question again."
        case .recordingFailed: "Truly could not record that question. Try again, or type it instead."
        case .tooShort: "That recording was too short. Try saying your question again."
        case .invalidResponse: "Truly could not understand that recording. Try again."
        case .server(let message): message
        }
    }
}

struct VoiceTranscriptionService {
    struct Response: Decodable { let text: String; let requiresReview: Bool }
    private struct Problem: Decodable { struct Detail: Decodable { let message: String }; let error: Detail }

    func transcribe(_ audio: Data, token: String) async throws -> Response {
        let baseURL = TrulyCoreConfiguration.baseURL
        let boundary = "TrulyBoundary\(UUID().uuidString)"
        var body = Data()
        body.append("--\(boundary)\r\nContent-Disposition: form-data; name=\"audio\"; filename=\"question.m4a\"\r\nContent-Type: audio/mp4\r\n\r\n".data(using: .utf8)!)
        body.append(audio)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        var request = URLRequest(url: baseURL.appending(path: "/v1/voice/transcriptions"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        request.setValue("groq-learning-v2", forHTTPHeaderField: "x-truly-consent-revision")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "content-type")
        request.httpBody = body
        request.timeoutInterval = 25
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw VoiceError.invalidResponse }
            guard (200..<300).contains(http.statusCode) else {
                let problem = try? JSONDecoder().decode(Problem.self, from: data)
                throw VoiceError.server(problem?.error.message ?? "Truly could not understand that recording. Try again.")
            }
            let result = try JSONDecoder().decode(Response.self, from: data)
            let transcript = result.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !transcript.isEmpty else { throw VoiceError.invalidResponse }
            return Response(text: transcript, requiresReview: result.requiresReview)
        } catch let error as VoiceError { throw error }
        catch { throw VoiceError.server("Truly could not connect for voice. Try again.") }
    }
}

@MainActor
final class SpeechPlaybackService: NSObject, AVSpeechSynthesizerDelegate {
    private let synthesizer = AVSpeechSynthesizer()
    private var activeUtterance: AVSpeechUtterance?
    var onPlayingChanged: ((Bool) -> Void)?
    override init() { super.init(); synthesizer.delegate = self }
    func speak(_ text: String) {
        synthesizer.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: text)
        activeUtterance = utterance
        utterance.rate = 0.48
        onPlayingChanged?(true)
        synthesizer.speak(utterance)
    }
    func stop() { activeUtterance = nil; synthesizer.stopSpeaking(at: .immediate); onPlayingChanged?(false) }
    private func finished(_ utterance: AVSpeechUtterance) {
        // A delayed cancellation for an old reply must not reopen the microphone
        // while a newer reply is being spoken. isSpeaking can be transient here.
        guard TrulySpeechPlaybackPolicy.acceptsCallback(active: activeUtterance.map(ObjectIdentifier.init),
                                                       callback: ObjectIdentifier(utterance)) else { return }
        activeUtterance = nil
        onPlayingChanged?(false)
    }
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor [weak self] in self?.finished(utterance) }
    }
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor [weak self] in self?.finished(utterance) }
    }
}
