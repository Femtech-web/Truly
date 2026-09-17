import AppKit
import SwiftUI

@main
struct TrulyApp: App {
    @NSApplicationDelegateAdaptor(TrulyAppDelegate.self) private var delegate

    var body: some Scene {
        Settings {
            EmptyView()
        }
    }
}

@MainActor
final class TrulyAppDelegate: NSObject, NSApplicationDelegate {
    let controller = DesktopAppController()
    private let popover = NSPopover()
    private var statusItem: NSStatusItem?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        configureMenuBarItem()
        controller.start()
    }

    private func configureMenuBarItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        guard let button = item.button else { return }

        let image = NSImage(systemSymbolName: "scope", accessibilityDescription: "Truly")
        image?.isTemplate = true
        button.image = image
        button.toolTip = "Truly"
        button.setAccessibilityLabel("Open Truly")
        button.target = self
        button.action = #selector(toggleMenuBarPopover(_:))

        let rootView = TrulyMenuBarView(controller: controller)
            .environmentObject(controller.learning)
            .environmentObject(controller.pairing)
        let hostingController = NSHostingController(rootView: rootView)
        hostingController.view.layoutSubtreeIfNeeded()

        popover.behavior = .transient
        popover.animates = true
        popover.contentViewController = hostingController
        popover.contentSize = CGSize(width: 300, height: 410)
        statusItem = item
    }

    @objc private func toggleMenuBarPopover(_ sender: Any?) {
        guard let button = statusItem?.button else { return }
        if popover.isShown {
            popover.performClose(sender)
        } else {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    func application(_ application: NSApplication, shouldSaveApplicationState coder: NSCoder) -> Bool { false }

    func application(_ application: NSApplication, shouldRestoreApplicationState coder: NSCoder) -> Bool { false }

    func applicationWillTerminate(_ notification: Notification) { controller.stop() }
}
