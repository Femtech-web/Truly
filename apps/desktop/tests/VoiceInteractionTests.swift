import Foundation

@main
struct VoiceInteractionTests {
    static func main() {
        let examples: [(String, String?)] = [
            ("Hey Truly explain this button", "explain this button"),
            ("HEY, TRULY: what should I do next?", "what should I do next?"),
            ("hey truly", ""),
            ("some unrelated speech hey truly help me", "help me"),
            ("Truly explain this", nil),
            ("hello truly explain this", nil),
            ("hey trulyish", nil),
            ("they truly understand it", nil),
            ("hey! truly explain it", nil),
        ]
        for (input, expected) in examples {
            precondition(TrulyWakePhrase.question(in: input) == expected, "Wake boundary failed")
        }
        precondition(TrulyVoiceTranscriptPolicy.question(in: "Hey Truly", questionOnly: false) == "")
        precondition(TrulyVoiceTranscriptPolicy.shouldContinueWithQuestionOnly(
            question: "", isFinal: true, questionOnly: false
        ))
        precondition(TrulyVoiceTranscriptPolicy.question(
            in: "what should I do next?", questionOnly: true
        ) == "what should I do next?")
        precondition(!TrulyVoiceTranscriptPolicy.shouldContinueWithQuestionOnly(
            question: "explain this", isFinal: true, questionOnly: false
        ))
        precondition(TrulyVoiceTranscriptPolicy.question(in: "background speech", questionOnly: false) == nil)
        let latchedWakeWords = TrulyVoiceTranscriptPolicy.wakeBoundaryWordCount(in: "Hey Truly")
        precondition(latchedWakeWords == 2)
        precondition(TrulyVoiceTranscriptPolicy.question(
            in: "Hey Trudy what am I doing here", afterWakeWordCount: latchedWakeWords
        ) == "what am I doing here")
        let embeddedWakeWords = TrulyVoiceTranscriptPolicy.wakeBoundaryWordCount(
            in: "background speech hey truly"
        )
        precondition(embeddedWakeWords == 4)
        precondition(TrulyVoiceTranscriptPolicy.question(
            in: "background speech hey trudy explain this", afterWakeWordCount: embeddedWakeWords
        ) == "explain this")
        precondition(TrulyVoiceTurnPolicy.action(
            question: "", isFinal: false, secondsSinceWake: 0.2, secondsSinceAudibleSpeech: 0.2
        ) == .wait)
        precondition(TrulyVoiceTurnPolicy.action(
            question: "", isFinal: false, secondsSinceWake: 1.25, secondsSinceAudibleSpeech: 0.1
        ) == .wait)
        precondition(TrulyVoiceTurnPolicy.action(
            question: "", isFinal: false, secondsSinceWake: 1.25, secondsSinceAudibleSpeech: 0.6
        ) == .finalizeCurrentSegment)
        precondition(TrulyVoiceTurnPolicy.action(
            question: "what am I doing here", isFinal: false,
            secondsSinceWake: 1.25, secondsSinceAudibleSpeech: 0.6
        ) == .wait)
        precondition(LearningMode.allCases.map(\.rawValue) == ["Explain", "Guide"])
        precondition(TrulyInputMode.allCases.map(\.rawValue) == ["Text", "Voice"])
        precondition(TrulyWakePhrase.teachingMode(for: "Please guide me through this") == .guide)
        precondition(TrulyWakePhrase.teachingMode(for: "Explain this button") == .explain)
        precondition(TrulyWakePhrase.teachingMode(for: "What does this button mean?") == nil)
        let allowed = TrulyVoiceEligibility(mode: .voice, paused: false, visible: true, paired: true,
                                           hasTask: true, processorApproved: true, wakeApproved: true)
        precondition(allowed.canListen)
        let forbidden = [
            TrulyVoiceEligibility(mode: .text, paused: false, visible: true, paired: true, hasTask: true, processorApproved: true, wakeApproved: true),
            TrulyVoiceEligibility(mode: .voice, paused: true, visible: true, paired: true, hasTask: true, processorApproved: true, wakeApproved: true),
            TrulyVoiceEligibility(mode: .voice, paused: false, visible: false, paired: true, hasTask: true, processorApproved: true, wakeApproved: true),
            TrulyVoiceEligibility(mode: .voice, paused: false, visible: true, paired: false, hasTask: true, processorApproved: true, wakeApproved: true),
            TrulyVoiceEligibility(mode: .voice, paused: false, visible: true, paired: true, hasTask: false, processorApproved: true, wakeApproved: true),
            TrulyVoiceEligibility(mode: .voice, paused: false, visible: true, paired: true, hasTask: true, processorApproved: false, wakeApproved: true),
            TrulyVoiceEligibility(mode: .voice, paused: false, visible: true, paired: true, hasTask: true, processorApproved: true, wakeApproved: false),
        ]
        for policy in forbidden { precondition(!policy.canListen) }
        precondition(!TrulyVoiceRecognitionPolicy.requiresReview(isFinal: true, wakeConfidences: [0.9, 0.9], questionConfidences: [0.9]))
        precondition(TrulyVoiceRecognitionPolicy.requiresReview(isFinal: false, wakeConfidences: [0.9, 0.9], questionConfidences: [0.9]))
        precondition(TrulyVoiceRecognitionPolicy.requiresReview(isFinal: true, wakeConfidences: [0.2, 0.9], questionConfidences: [0.9]))
        precondition(TrulyVoiceRecognitionPolicy.requiresReview(isFinal: true, wakeConfidences: [], questionConfidences: [0.9]))
        precondition(TrulyVoiceRecognitionPolicy.requiresReview(isFinal: true, wakeConfidences: [0.9, 0.9], questionConfidences: [0]))
        precondition(TrulyVoiceRecognitionPolicy.requiresReview(isFinal: true, wakeConfidences: [0.9, 0.9], questionConfidences: []))
        precondition(TrulyVoiceRecognitionPolicy.discardsCorrectedWake(question: nil, isFinal: true))
        precondition(!TrulyVoiceRecognitionPolicy.discardsCorrectedWake(question: nil, isFinal: false))
        precondition(!TrulyVoiceRecognitionPolicy.discardsCorrectedWake(question: "explain", isFinal: true))
        let first = NSObject(), second = NSObject()
        precondition(TrulySpeechPlaybackPolicy.acceptsCallback(active: ObjectIdentifier(first), callback: ObjectIdentifier(first)))
        precondition(!TrulySpeechPlaybackPolicy.acceptsCallback(active: ObjectIdentifier(second), callback: ObjectIdentifier(first)))
        precondition(!TrulySpeechPlaybackPolicy.acceptsCallback(active: nil, callback: ObjectIdentifier(first)))
        precondition(TrulyVoiceAnswerPresentationPolicy.shouldPresentWorkspace(answerPending: true, phase: .failed("offline")))
        precondition(!TrulyVoiceAnswerPresentationPolicy.shouldPresentWorkspace(answerPending: false, phase: .failed("offline")))
        precondition(!TrulyVoiceAnswerPresentationPolicy.shouldPresentWorkspace(answerPending: true, phase: .responding))
        precondition(TrulyTransientNetworkPolicy.shouldRetry(URLError(.timedOut), attempt: 0))
        precondition(TrulyTransientNetworkPolicy.shouldRetry(URLError(.networkConnectionLost), attempt: 0))
        precondition(TrulyTransientNetworkPolicy.shouldRetry(URLError(.cannotConnectToHost), attempt: 0))
        precondition(!TrulyTransientNetworkPolicy.shouldRetry(URLError(.timedOut), attempt: 1))
        precondition(!TrulyTransientNetworkPolicy.shouldRetry(URLError(.badURL), attempt: 0))
        print("56 voice/input/network boundary checks passed")
    }
}
