import Foundation
import CoreGraphics

enum LearningReadyNoticePlacement: Equatable {
    case besideCompanion
    case screenCorner
}

enum LearningReadyNoticePolicy {
    static func placement(companionVisible: Bool) -> LearningReadyNoticePlacement {
        companionVisible ? .besideCompanion : .screenCorner
    }

    static func message(companionVisible: Bool) -> String {
        companionVisible
            ? "Ready to begin on this Mac."
            : "Loaded on Truly. The companion stays hidden; show it anytime from the menu bar."
    }
}

enum TrulyResponseText {
    static func plainText(from raw: String) -> String {
        let inline: String
        do {
            let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
            inline = String(try AttributedString(markdown: raw, options: options).characters)
        } catch {
            inline = raw
        }

        var insideCodeFence = false
        var blankLinePending = false
        var output: [String] = []
        for sourceLine in inline.components(separatedBy: .newlines) {
            let trimmed = sourceLine.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("```") || trimmed.hasPrefix("~~~") {
                insideCodeFence.toggle()
                continue
            }

            var line = sourceLine
            if !insideCodeFence {
                line = line.replacingOccurrences(of: #"^\s{0,3}#{1,6}\s+"#, with: "", options: .regularExpression)
                line = line.replacingOccurrences(of: #"^\s*>\s?"#, with: "", options: .regularExpression)
                line = line.replacingOccurrences(of: #"^\s*[-+*]\s+"#, with: "• ", options: .regularExpression)
            }
            line = line.replacingOccurrences(of: "**", with: "")
                .replacingOccurrences(of: "__", with: "")
                .replacingOccurrences(of: "`", with: "")

            if line.trimmingCharacters(in: .whitespaces).isEmpty {
                if !output.isEmpty { blankLinePending = true }
                continue
            }
            if blankLinePending { output.append(""); blankLinePending = false }
            output.append(line.trimmingCharacters(in: .whitespaces))
        }
        return output.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

enum LearningMode: String, CaseIterable, Identifiable {
    case explain = "Explain"
    case guide = "Guide"

    var id: String { rawValue }

    var helperText: String {
        switch self {
        case .explain:
            "Understand what is visible"
        case .guide:
            "Work through one step"
        }
    }

}

enum LearningSessionPhase: Equatable {
    case idle
    case observing
    case responding
    case awaitingAttempt
    case evaluatingAttempt
    case complete
    case failed(String)

    var label: String {
        switch self {
        case .idle: "Ready"
        case .observing: "Looking at your screen"
        case .responding: "Teaching"
        case .awaitingAttempt: "Waiting for your attempt"
        case .evaluatingAttempt: "Checking your work"
        case .complete: "Complete"
        case .failed: "Needs attention"
        }
    }

    var isBusy: Bool {
        self == .observing || self == .responding || self == .evaluatingAttempt
    }
}

struct DesktopLearningSession: Decodable, Equatable, Sendable {
    struct LearningLink: Decodable, Equatable, Sendable, Identifiable {
        let title: String
        let url: String
        var id: String { url }

        var host: String {
            URL(string: url)?.host() ?? "link"
        }
    }

    struct Device: Decodable, Equatable, Sendable {
        let id: String
        let name: String
    }

    struct Source: Decodable, Equatable, Sendable {
        let kind: String
        let id: String
        let taskId: String?
        let title: String
        let summary: String
        let creatorName: String?
        let version: Int?
        let outcomes: [String]
        let prerequisites: [String]
        let supportedEnvironments: [String]
        let estimatedMinutes: Int?
        let stepCount: Int
        let workspaceLink: LearningLink?
        let resources: [LearningLink]?
    }

    struct Step: Decodable, Equatable, Sendable {
        let id: String
        let title: String
        let summary: String
        let index: Int
        let total: Int
        let workspaceLink: LearningLink?
        let resources: [LearningLink]?
        let challenge: String?
        let rubric: [String]?
    }

    let id: String
    let status: String
    let device: Device
    let source: Source
    let currentStep: Step
    let startedAt: String
    let updatedAt: String
    struct Progress: Decodable, Equatable, Sendable {
        let completedStepIds: [String]
        let completedCount: Int
        let total: Int
        let assessment: String
    }
    let progress: Progress?

    var preferredWorkspaceLink: LearningLink? {
        currentStep.workspaceLink ?? source.workspaceLink
    }

    var availableResources: [LearningLink] {
        var seen = Set<String>()
        return ((currentStep.resources ?? []) + (source.resources ?? [])).filter { seen.insert($0.url).inserted }
    }
}
