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
}
