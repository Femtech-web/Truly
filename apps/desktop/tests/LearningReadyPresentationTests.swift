import Foundation

@main
struct LearningReadyPresentationTests {
    static func main() {
        precondition(LearningReadyNoticePolicy.placement(companionVisible: true) == .besideCompanion)
        precondition(LearningReadyNoticePolicy.placement(companionVisible: false) == .screenCorner)
        precondition(LearningReadyNoticePolicy.message(companionVisible: true) == "Ready to begin on this Mac.")
        precondition(LearningReadyNoticePolicy.message(companionVisible: false).contains("stays hidden"))
        print("4 learning-ready presentation checks passed")
    }
}
