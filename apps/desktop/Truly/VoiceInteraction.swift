import Foundation

enum TrulyInputMode: String, CaseIterable, Identifiable {
    case text = "Text"
    case voice = "Voice"
    var id: String { rawValue }
}

/// Pure, testable phrase boundary. A wake phrase is not speaker authentication.
enum TrulyWakePhrase {
    static func range(in transcript: String) -> Range<String.Index>? {
        transcript.range(of: #"\bhey[\s,]+truly\b[\s,.!?:;-]*"#, options: [.regularExpression, .caseInsensitive])
    }
    static func question(in transcript: String) -> String? {
        guard let range = range(in: transcript) else { return nil }
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

enum TrulyVoiceRecognitionPolicy {
    /// Unknown/partial confidence is never permission to send a frame automatically.
    static func requiresReview(isFinal: Bool, wakeConfidences: [Float], questionConfidences: [Float]) -> Bool {
        !isFinal || wakeConfidences.isEmpty || questionConfidences.isEmpty
            || (wakeConfidences + questionConfidences).contains { !$0.isFinite || $0 < 0.5 || $0 > 1 }
    }

    /// A recognizer can retract a partial wake phrase. Never submit its stale suffix.
    static func discardsCorrectedWake(question: String?, isFinal: Bool) -> Bool {
        isFinal && question == nil
    }
}

enum TrulySpeechPlaybackPolicy {
    static func acceptsCallback(active: ObjectIdentifier?, callback: ObjectIdentifier) -> Bool {
        active == callback
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
