import AppKit
import SwiftUI

@MainActor
final class DesktopAppController: NSObject, ObservableObject, NSWindowDelegate {
    let learning: LearningSessionModel
    let pairing: DevicePairingModel
    @Published private(set) var companionVisible = true
    private var workspace: NSWindow?
    private var taskPanel: NSWindow?
    private var settingsPanel: NSWindow?
    private var capturing = false
    private let pointer = PointerOverlayController()
    private lazy var companion = CompanionPanelController { [weak self] point in
        self?.shareContext(at: point)
    }

    override init() {
        let pairing = DevicePairingModel()
        self.pairing = pairing
        self.learning = LearningSessionModel(sessionToken: { [weak pairing] in pairing?.desktopSessionToken })
        super.init()
        learning.onResponseReady = { [weak self] x, y, frame, message in
            self?.workspace?.orderOut(nil)
            self?.pointer.showResponse(
                normalizedX: x,
                normalizedY: y.map { 1 - $0 },
                on: frame,
                message: message
            )
        }
        pairing.onLearningSessionChanged = { [weak self] session, change in
            guard let self else { return }
            self.learning.activateLearningSession(session)
            if let session, change == .updated {
                self.companion.showLearningReady(
                    title: session.source.title,
                    workspaceLink: session.preferredWorkspaceLink,
                    onOpen: { [weak self] link in self?.openExternalLink(link) }
                )
            }
        }
    }

    func start() {
        learning.prepare()
        companion.show(greeting: true)
        learning.activateLearningSession(pairing.activeLearningSession)
        pairing.onRevoked = { [weak self] in self?.learning.activateLearningSession(nil) }
    }

    func stop() { companion.hide(); pairing.stopMonitoring(); learning.resetSession() }

    func toggleCompanion() {
        companionVisible.toggle()
        if companionVisible { companion.show() } else { companion.hide() }
    }

    func shareContext(at point: CGPoint) {
        guard !capturing else { return }
        capturing = true
        let foreground = NSWorkspace.shared.frontmostApplication
        let appName = foreground?.processIdentifier == ProcessInfo.processInfo.processIdentifier
            ? "Shared screen" : (foreground?.localizedName ?? "Shared screen")
        Task {
            // Capture before activating Truly, so the preview is the learner's work.
            await learning.shareContext(at: point, appName: appName)
            capturing = false
            openWorkspace()
        }
    }

    func openWorkspace() {
        if workspace == nil {
            let window = CompactWorkspacePanel(contentRect: CGRect(x: 0, y: 0, width: 500, height: 104),
                                  styleMask: [.borderless], backing: .buffered, defer: false)
            window.isOpaque = false
            window.backgroundColor = .clear
            window.hasShadow = true
            window.isMovableByWindowBackground = true
            window.appearance = NSAppearance(named: .aqua)
            window.minSize = CGSize(width: 480, height: 96)
            window.maxSize = CGSize(width: 560, height: 122)
            window.level = .floating
            window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
            window.isReleasedWhenClosed = false
            window.delegate = self
            window.contentView = NSHostingView(rootView: TrulyRootView(onClose: { [weak window] in window?.close() })
                .environmentObject(learning)
                .environmentObject(pairing))
            window.center()
            workspace = window
        }
        NSApp.activate(ignoringOtherApps: true)
        workspace?.makeKeyAndOrderFront(nil)
    }

    func openTaskPanel() {
        if taskPanel == nil {
            let window = NSPanel(contentRect: CGRect(x: 0, y: 0, width: 390, height: 440),
                                 styleMask: [.titled, .closable], backing: .buffered, defer: false)
            window.title = "Current Task"
            window.isReleasedWhenClosed = false
            window.contentView = NSHostingView(rootView: TrulyTaskPanelView(controller: self)
                .environmentObject(pairing))
            window.center()
            taskPanel = window
        }
        NSApp.activate(ignoringOtherApps: true)
        taskPanel?.makeKeyAndOrderFront(nil)
    }

    func openSettings() {
        if settingsPanel == nil {
            let window = NSPanel(contentRect: CGRect(x: 0, y: 0, width: 420, height: 500),
                                 styleMask: [.titled, .closable], backing: .buffered, defer: false)
            window.title = "Truly Settings"
            window.isReleasedWhenClosed = false
            window.contentView = NSHostingView(rootView: TrulySettingsView()
                .environmentObject(learning)
                .environmentObject(pairing))
            window.center()
            settingsPanel = window
        }
        NSApp.activate(ignoringOtherApps: true)
        settingsPanel?.makeKeyAndOrderFront(nil)
    }

    func openExternalLink(_ link: DesktopLearningSession.LearningLink) {
        guard let url = URL(string: link.url), url.user == nil, url.password == nil else { return }
        let localHTTP = url.scheme == "http" && ["localhost", "127.0.0.1", "::1", "[::1]"].contains(url.host ?? "")
        guard url.scheme == "https" || localHTTP else { return }
        NSWorkspace.shared.open(url)
    }

    func windowWillClose(_ notification: Notification) {
        pointer.hidePointer()
        learning.resetSession()
        if companionVisible { companion.show() }
    }
}

private final class CompactWorkspacePanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}
