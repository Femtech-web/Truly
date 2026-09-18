import Foundation

@main
struct ResponseTextTests {
    static func main() {
        let raw = """
        This page is the **Nimiq Provider** reference. Use `init()` from `@nimiq/mini-app-sdk`.

        ## Next steps
        - Connect the provider
        - Request approval
        """
        let cleaned = TrulyResponseText.plainText(from: raw)
        precondition(!cleaned.contains("**"), "Bold markers leaked into the answer")
        precondition(!cleaned.contains("`"), "Code markers leaked into the answer")
        precondition(!cleaned.contains("##"), "Heading markers leaked into the answer")
        precondition(cleaned.contains("Nimiq Provider"))
        precondition(cleaned.contains("init()"))
        precondition(cleaned.contains("Connect the provider"))
        print("6 response-text cleanup checks passed")
    }
}
