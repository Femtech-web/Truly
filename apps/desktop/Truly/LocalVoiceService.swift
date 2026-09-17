import AVFoundation
import Speech
import SwiftUI

enum LocalVoiceState: Equatable {
    case paused, starting, armed, listening, working, speaking
    case unavailable(String)

    var label: String {
        switch self {
        case .paused: "Voice paused"
        case .starting: "Starting voice…"
        case .armed: "Say ‘Hey Truly’"
        case .listening: "Listening to your question…"
        case .working: "Thinking…"
        case .speaking: "Reading the reply…"
        case .unavailable(let message): message
        }
    }
}

/// Ambient audio is processed only by Apple's required-on-device recognizer.
/// No audio files, network calls, transcript logging or cloud fallback here.
@MainActor
final class LocalVoiceService: ObservableObject {
    @Published private(set) var state: LocalVoiceState = .paused
    var onWake: (() -> Void)?
    var onQuestion: ((String, Bool) -> Void)?
    var onStateChanged: ((LocalVoiceState) -> Void)?
    private let engine = AVAudioEngine()
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var recognition: SFSpeechRecognitionTask?
    private var permissionTask: Task<Void, Never>?
    private var segmentTimer: Task<Void, Never>?
    private var silenceTimer: Task<Void, Never>?
    private var tapInstalled = false
    private var generation = UUID()
    private var question = ""
    private var needsReview = false

    func start() {
        guard state == .paused else { return }
        let generation = self.generation
        setState(.starting)
        permissionTask = Task { [weak self] in
            guard let self else { return }
            let microphone: Bool
            if MicrophonePermissionService.state.isGranted { microphone = true }
            else { microphone = await MicrophonePermissionService.requestPermission() }
            guard !Task.isCancelled, generation == self.generation else { return }
            guard microphone else {
                stop(as: .unavailable("Allow Microphone access in macOS settings, or use Text mode.")); return
            }
            let status: SFSpeechRecognizerAuthorizationStatus
            if SFSpeechRecognizer.authorizationStatus() == .notDetermined {
                status = await withCheckedContinuation { continuation in
                    SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
                }
            } else { status = SFSpeechRecognizer.authorizationStatus() }
            guard !Task.isCancelled, generation == self.generation else { return }
            guard status == .authorized else {
                stop(as: .unavailable("Allow Speech Recognition in macOS settings, or use Text mode.")); return
            }
            beginSegment()
        }
    }

    func stop(as state: LocalVoiceState = .paused) {
        generation = UUID()
        permissionTask?.cancel(); permissionTask = nil
        releaseAudio()
        question = ""; needsReview = false
        setState(state)
    }

    private func setState(_ value: LocalVoiceState) {
        state = value
        onStateChanged?(value)
    }

    private func beginSegment() {
        guard let recognizer, recognizer.supportsOnDeviceRecognition, recognizer.isAvailable else {
            stop(as: .unavailable("Hands-free voice is unavailable on this Mac. Use Text mode or Record a question.")); return
        }
        releaseAudio()
        generation = UUID()
        let generation = self.generation
        question = ""; needsReview = false
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = true
        request.contextualStrings = ["Hey Truly"]
        self.request = request
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            stop(as: .unavailable("Truly cannot find a microphone. Check macOS sound settings.")); return
        }
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in request.append(buffer) }
        tapInstalled = true
        recognition = recognizer.recognitionTask(with: request) { [weak self] result, error in
            // Only an explicitly activated question is retained beyond this callback.
            let transcript = result?.bestTranscription.formattedString
            let uncertain = result?.bestTranscription.segments.contains { $0.confidence > 0 && $0.confidence < 0.5 } ?? false
            let final = result?.isFinal ?? false
            let failed = error != nil
            Task { @MainActor [weak self] in
                guard let self, generation == self.generation else { return }
                if let transcript { receive(transcript, final: final, uncertain: uncertain) }
                guard generation == self.generation else { return }
                if failed { stop(as: .unavailable("Voice stopped. Resume voice to try again, or use Text mode.")) }
            }
        }
        do { engine.prepare(); try engine.start() }
        catch { stop(as: .unavailable("Truly could not start the microphone. Use Text mode and try again later.")); return }
        setState(.armed)
        segmentTimer = Task { [weak self] in
            try? await Task.sleep(for: .seconds(45))
            guard !Task.isCancelled, let self, generation == self.generation else { return }
            if state == .listening { finishQuestion() } else { beginSegment() }
        }
    }

    private func receive(_ transcript: String, final: Bool, uncertain: Bool) {
        guard state == .armed || state == .listening else { return }
        if let spokenQuestion = TrulyWakePhrase.question(in: transcript) {
            if state == .armed {
                setState(.listening)
                onWake?()
                // Bound the utterance from wake detection, independent of recognizer restarts.
                segmentTimer?.cancel()
                let generation = self.generation
                segmentTimer = Task { [weak self] in
                    try? await Task.sleep(for: .seconds(30))
                    guard !Task.isCancelled, let self, generation == self.generation else { return }
                    finishQuestion()
                }
            }
            if spokenQuestion != question || silenceTimer == nil {
                question = spokenQuestion
                needsReview = uncertain
                armSilenceTimer()
            }
            if final { finishQuestion() }
        } else if final && state == .armed { beginSegment() }
    }

    private func armSilenceTimer() {
        silenceTimer?.cancel()
        let generation = self.generation
        let delay: Double = question.isEmpty ? 8 : 1.6
        silenceTimer = Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled, let self, generation == self.generation else { return }
            finishQuestion()
        }
    }

    private func finishQuestion() {
        let text = question
        let uncertain = needsReview
        guard !text.isEmpty, text.count <= 2_000 else {
            stop(as: .unavailable("Truly did not hear a question. Resume voice and say ‘Hey Truly’ followed by your question.")); return
        }
        stop(as: .working)
        onQuestion?(text, uncertain)
    }

    private func releaseAudio() {
        segmentTimer?.cancel(); segmentTimer = nil
        silenceTimer?.cancel(); silenceTimer = nil
        engine.stop()
        if tapInstalled { engine.inputNode.removeTap(onBus: 0); tapInstalled = false }
        request?.endAudio(); request = nil
        recognition?.cancel(); recognition = nil
    }
}
