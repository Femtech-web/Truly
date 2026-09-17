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
        print("22 voice/input boundary checks passed")
    }
}
