import Foundation

enum TrulyInputMode: String, CaseIterable, Identifiable {
    case text = "Text"
    case voice = "Voice"
    var id: String { rawValue }
}

/// Pure, testable phrase boundary. A wake phrase is not speaker authentication.
enum TrulyWakePhrase {
    static func question(in transcript: String) -> String? {
        let pattern = #"\bhey[\s,]+truly\b[\s,.!?:;-]*"#
        guard let range = transcript.range(of: pattern, options: [.regularExpression, .caseInsensitive]) else { return nil }
        return String(transcript[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func teachingMode(for question: String) -> LearningMode? {
        if question.range(of: #"^(please\s+)?(guide\b|walk me\b|show me how\b|what should I do next\b)"#,
                          options: [.regularExpression, .caseInsensitive]) != nil { return .guide }
        if question.range(of: #"^(please\s+)?explain\b"#,
                          options: [.regularExpression, .caseInsensitive]) != nil { return .explain }
        return nil
    }
}

struct TrulyVoiceEligibility {
    let mode: TrulyInputMode
    let paused: Bool
    let visible: Bool
    let paired: Bool
    let hasTask: Bool
    let processorApproved: Bool
    let wakeApproved: Bool
    var canListen: Bool {
        mode == .voice && !paused && visible && paired && hasTask && processorApproved && wakeApproved
    }
}
