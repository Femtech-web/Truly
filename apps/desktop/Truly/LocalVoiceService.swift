import AVFoundation
import Speech
import SwiftUI

enum LocalVoiceState: Equatable {
    case paused, starting, armed, listening, finalizing, working, speaking
    case unavailable(String)

    var label: String {
        switch self {
        case .paused: "Voice paused"
        case .starting: "Starting voice…"
        case .armed: "Say ‘Hey Truly’"
        case .listening: "Listening to your question…"
        case .finalizing: "Writing down your question…"
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
    private var questionOnly = false
    private var wakeNeedsReview = false
    private var wakeBoundaryWordCount: Int?
    private var wakeDetectedAt = Date.distantPast
    private var lastAudibleSpeech = Date.distantPast
    private var finishing = false
    private var finalTimer: Task<Void, Never>?

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
        question = ""; needsReview = false; questionOnly = false; wakeNeedsReview = false
        wakeBoundaryWordCount = nil; wakeDetectedAt = .distantPast; finishing = false
        setState(state)
    }

    private func setState(_ value: LocalVoiceState) {
        state = value
        onStateChanged?(value)
    }

    private func beginSegment(questionOnly: Bool = false) {
        guard let recognizer, recognizer.supportsOnDeviceRecognition, recognizer.isAvailable else {
            stop(as: .unavailable("Hands-free voice is unavailable on this Mac. Use Text mode or Record a question.")); return
        }
        generation = UUID()
        let generation = self.generation
        releaseAudio()
        self.questionOnly = questionOnly
        question = ""; needsReview = false
        if !questionOnly {
            wakeNeedsReview = false; wakeBoundaryWordCount = nil; wakeDetectedAt = .distantPast
        }
        finishing = false
        lastAudibleSpeech = Date.distantPast
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = true
        if !questionOnly { request.contextualStrings = ["Hey Truly"] }
        self.request = request
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            stop(as: .unavailable("Truly cannot find a microphone. Check macOS sound settings.")); return
        }
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            request.append(buffer)
            guard let samples = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return }
            var squares: Float = 0
            for index in 0..<Int(buffer.frameLength) { squares += samples[index] * samples[index] }
            let audible = squares / Float(buffer.frameLength) > 0.000_063 // About -42 dBFS; tune in native acceptance.
            if audible {
                Task { @MainActor [weak self] in
                    guard let self, generation == self.generation, state == .listening else { return }
                    lastAudibleSpeech = Date()
                }
            }
        }
        tapInstalled = true
        recognition = recognizer.recognitionTask(with: request) { [weak self] result, error in
            // Only an explicitly activated question is retained beyond this callback.
            let transcript = result?.bestTranscription.formattedString
            let text = transcript ?? ""
            let spokenQuestion = TrulyVoiceTranscriptPolicy.question(in: text, questionOnly: questionOnly)
            let detectedWakeWordCount = questionOnly ? nil : TrulyVoiceTranscriptPolicy.wakeBoundaryWordCount(in: text)
            let questionStart = questionOnly ? 0 : text.utf16.count - (spokenQuestion?.utf16.count ?? 0)
            let final = result?.isFinal ?? false
            let segments = result?.bestTranscription.segments ?? []
            let wakeRange = questionOnly ? nil : TrulyWakePhrase.range(in: text).map { NSRange($0, in: text) }
            let wakeConfidences = segments.filter { segment in
                guard let wakeRange else { return false }
                return NSIntersectionRange(segment.substringRange, wakeRange).length > 0
            }.map(\.confidence)
            let questionConfidences = spokenQuestion == nil && !questionOnly
                ? segments.map(\.confidence)
                : segments.filter { $0.substringRange.location >= questionStart }.map(\.confidence)
            let wakeUncertain = TrulyVoiceRecognitionPolicy.hasUncertainConfidence(wakeConfidences)
            let questionUncertain = !final || TrulyVoiceRecognitionPolicy.hasUncertainConfidence(questionConfidences)
            let failed = error != nil
            let hadResult = result != nil
            Task { @MainActor [weak self] in
                guard let self, generation == self.generation else { return }
                if hadResult {
                    receive(transcript: text, spokenQuestion: spokenQuestion,
                            detectedWakeWordCount: detectedWakeWordCount,
                            final: final, wakeUncertain: wakeUncertain,
                            questionUncertain: questionUncertain, questionOnly: questionOnly)
                }
                guard generation == self.generation else { return }
                if failed && !finishing { stop(as: .unavailable("Voice stopped. Resume voice to try again, or use Text mode.")) }
            }
        }
        do { engine.prepare(); try engine.start() }
        catch { stop(as: .unavailable("Truly could not start the microphone. Use Text mode and try again later.")); return }
        setState(questionOnly ? .listening : .armed)
        segmentTimer = Task { [weak self] in
            try? await Task.sleep(for: .seconds(45))
            guard !Task.isCancelled, let self, generation == self.generation else { return }
            if state == .listening { finishQuestion() } else { beginSegment() }
        }
    }

    private func receive(transcript: String, spokenQuestion: String?, detectedWakeWordCount: Int?,
                         final: Bool, wakeUncertain: Bool, questionUncertain: Bool,
                         questionOnly: Bool) {
        guard state == .armed || state == .listening || finishing else { return }
        if !questionOnly, let detectedWakeWordCount {
            wakeBoundaryWordCount = detectedWakeWordCount
        }
        let resolvedQuestion: String?
        if let spokenQuestion { resolvedQuestion = spokenQuestion }
        else if !questionOnly, state == .listening || finishing {
            resolvedQuestion = TrulyVoiceTranscriptPolicy.question(
                in: transcript, afterWakeWordCount: wakeBoundaryWordCount
            )
        } else { resolvedQuestion = nil }
        if resolvedQuestion == nil && (state == .listening || finishing) {
            if !finishing { armSilenceTimer() }
        }
        if let spokenQuestion = resolvedQuestion {
            if state == .armed {
                setState(.listening)
                lastAudibleSpeech = Date()
                wakeDetectedAt = Date()
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
            if !questionOnly, detectedWakeWordCount != nil { wakeNeedsReview = wakeUncertain }
            if TrulyVoiceTranscriptPolicy.shouldContinueWithQuestionOnly(
                question: spokenQuestion, isFinal: final, questionOnly: questionOnly
            ) {
                beginSegment(questionOnly: true)
                return
            }
            let uncertain = wakeNeedsReview || questionUncertain
            if spokenQuestion != question || silenceTimer == nil {
                question = spokenQuestion
                needsReview = uncertain
                if !finishing { armSilenceTimer() }
            }
            if final { needsReview = uncertain; deliverQuestion() }
        }
    }

    private func armSilenceTimer() {
        silenceTimer?.cancel()
        let generation = self.generation
        let delay = question.isEmpty ? TrulyVoiceTurnPolicy.wakeOnlyGraceSeconds : 1.6
        silenceTimer = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(delay))
                guard !Task.isCancelled, let self, generation == self.generation else { return }
                // Partial recognition may pause during a long phrase; don't cut off audible speech.
                let wakeAction = TrulyVoiceTurnPolicy.action(
                    question: question,
                    isFinal: false,
                    secondsSinceWake: Date().timeIntervalSince(wakeDetectedAt),
                    secondsSinceAudibleSpeech: Date().timeIntervalSince(lastAudibleSpeech)
                )
                if wakeAction == .finalizeCurrentSegment ||
                    (!question.isEmpty && Date().timeIntervalSince(lastAudibleSpeech) >= 1.6) {
                    finishQuestion(); return
                }
            }
        }
    }

    private func finishQuestion() {
        guard !finishing else { return }
        finishing = true
        segmentTimer?.cancel(); segmentTimer = nil
        silenceTimer?.cancel(); silenceTimer = nil
        engine.stop()
        if tapInstalled { engine.inputNode.removeTap(onBus: 0); tapInstalled = false }
        request?.endAudio()
        setState(.finalizing)
        let generation = self.generation
        finalTimer = Task { [weak self] in
            try? await Task.sleep(for: .seconds(1.5))
            guard !Task.isCancelled, let self, generation == self.generation else { return }
            // Partial recognition has no trustworthy final confidence. Ask for review.
            needsReview = true
            deliverQuestion()
        }
    }

    private func deliverQuestion() {
        let text = question
        let uncertain = needsReview
        guard !text.isEmpty, text.count <= 2_000 else {
            stop(as: .unavailable("Truly did not hear a question. Resume voice and say ‘Hey Truly’ followed by your question.")); return
        }
        stop(as: .working)
        onQuestion?(text, uncertain)
    }

    private func releaseAudio() {
        finalTimer?.cancel(); finalTimer = nil
        segmentTimer?.cancel(); segmentTimer = nil
        silenceTimer?.cancel(); silenceTimer = nil
        engine.stop()
        if tapInstalled { engine.inputNode.removeTap(onBus: 0); tapInstalled = false }
        request?.endAudio(); request = nil
        recognition?.cancel(); recognition = nil
    }
}
