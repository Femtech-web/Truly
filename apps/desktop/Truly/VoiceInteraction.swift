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

/// Keeps wake detection and question capture separate when Apple finalizes them as two utterances.
enum TrulyVoiceTranscriptPolicy {
    static func wakeBoundaryWordCount(in transcript: String) -> Int? {
        guard let range = TrulyWakePhrase.range(in: transcript) else { return nil }
        return transcript[..<range.upperBound].split(whereSeparator: \.isWhitespace).count
    }

    /// Apple can revise an already accepted partial wake phrase in later cumulative results.
    /// Once wake is latched, retain its word boundary instead of requiring the spelling again.
    static func question(in transcript: String, afterWakeWordCount count: Int?) -> String? {
        guard let count else { return nil }
        let words = transcript.split(whereSeparator: \.isWhitespace)
        guard count <= words.count else { return "" }
        return words.dropFirst(count).joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func question(in transcript: String, questionOnly: Bool) -> String? {
        if questionOnly {
            let value = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
            return value.isEmpty ? nil : value
        }
        return TrulyWakePhrase.question(in: transcript)
    }

    static func shouldContinueWithQuestionOnly(question: String?, isFinal: Bool, questionOnly: Bool) -> Bool {
        !questionOnly && isFinal && question == ""
    }
}

enum TrulyVoiceTurnAction: Equatable {
    case wait
    case finalizeCurrentSegment
}

enum TrulyVoiceTurnPolicy {
    /// Long enough for a continuous sentence to add its suffix, short enough that a standalone
    /// wake phrase feels like one interaction instead of forcing the learner to repeat it.
    static let wakeOnlyGraceSeconds = 1.0

    static func action(question: String, isFinal: Bool, secondsSinceWake: TimeInterval,
                       secondsSinceAudibleSpeech: TimeInterval) -> TrulyVoiceTurnAction {
        guard question.isEmpty else { return .wait }
        let quietAfterWake = secondsSinceWake >= wakeOnlyGraceSeconds && secondsSinceAudibleSpeech >= 0.45
        return isFinal || quietAfterWake ? .finalizeCurrentSegment : .wait
    }
}

enum TrulyVoiceRecognitionPolicy {
    static func hasUncertainConfidence(_ values: [Float]) -> Bool {
        values.isEmpty || values.contains { !$0.isFinite || $0 < 0.5 || $0 > 1 }
    }

    /// Unknown/partial confidence is never permission to send a frame automatically.
    static func requiresReview(isFinal: Bool, wakeConfidences: [Float], questionConfidences: [Float]) -> Bool {
        !isFinal || hasUncertainConfidence(wakeConfidences) || hasUncertainConfidence(questionConfidences)
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

enum TrulyVoiceAnswerPresentationPolicy {
    static func shouldPresentWorkspace(answerPending: Bool, phase: LearningSessionPhase) -> Bool {
        guard answerPending else { return false }
        if case .failed = phase { return true }
        return false
    }
}

enum TrulyTransientNetworkPolicy {
    static func shouldRetry(_ error: Error, attempt: Int) -> Bool {
        guard attempt == 0, let urlError = error as? URLError else { return false }
        return urlError.code == .timedOut || urlError.code == .networkConnectionLost ||
            urlError.code == .cannotConnectToHost
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
