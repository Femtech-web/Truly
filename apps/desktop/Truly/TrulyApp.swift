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

        button.image = trulyMenuBarImage()
        button.imagePosition = .imageOnly
        button.toolTip = "Truly"
        button.setAccessibilityLabel("Open Truly")
        button.target = self
        button.action = #selector(toggleMenuBarPopover(_:))

        let rootView = TrulyMenuBarView(controller: controller)
            .environmentObject(controller.learning)
            .environmentObject(controller.pairing)
        let hostingController = NSHostingController(rootView: rootView)
        hostingController.sizingOptions = [.preferredContentSize]
        hostingController.view.layoutSubtreeIfNeeded()

        popover.behavior = .transient
        popover.animates = true
        popover.contentViewController = hostingController
        popover.contentSize = hostingController.view.fittingSize
        statusItem = item
    }

    private func trulyMenuBarImage() -> NSImage {
        let image = NSImage(size: NSSize(width: 18, height: 18), flipped: false) { _ in
            NSColor.black.setStroke()
            let ring = NSBezierPath(ovalIn: NSRect(x: 2, y: 2, width: 11.5, height: 11.5))
            ring.lineWidth = 2
            ring.stroke()

            NSColor.black.setFill()
            NSBezierPath(ovalIn: NSRect(x: 13.2, y: 13.2, width: 3.8, height: 3.8)).fill()
            return true
        }
        image.isTemplate = true
        image.accessibilityDescription = "Truly"
        return image
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
