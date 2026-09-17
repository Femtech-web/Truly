import Foundation
import CoreGraphics

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

    var preferredWorkspaceLink: LearningLink? {
        currentStep.workspaceLink ?? source.workspaceLink
    }

    var availableResources: [LearningLink] {
        var seen = Set<String>()
        return ((currentStep.resources ?? []) + (source.resources ?? [])).filter { seen.insert($0.url).inserted }
    }
}
