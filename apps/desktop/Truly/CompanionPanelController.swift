import AppKit
import SwiftUI

/// A draggable companion, not a system-cursor replacement or click interceptor.
@MainActor
final class CompanionPanelController {
    private let onInvoke: (CGPoint) -> Void
    private var panel: NSPanel?
    private var greetingPanel: NSPanel?

    init(onInvoke: @escaping (CGPoint) -> Void) { self.onInvoke = onInvoke }

    func show(greeting: Bool = false) {
        if panel == nil {
            let panel = makePanel(size: CGSize(width: 40, height: 44))
            let view = CompanionHitView(frame: CGRect(x: 0, y: 0, width: 40, height: 44))
            view.onInvoke = { [weak self] point in self?.onInvoke(point) }
            view.onMove = { [weak self] _ in self?.positionNoticeBesideCompanion() }
            panel.contentView = view
            view.setAccessibilityElement(true)
            view.setAccessibilityRole(.button)
            view.setAccessibilityLabel("Share this screen with Truly")
            view.setAccessibilityHelp("Drag to position. Click to share this display and open the learning workspace.")
            let frame = NSScreen.main?.visibleFrame ?? CGRect(x: 0, y: 0, width: 1000, height: 700)
            panel.setFrameOrigin(CGPoint(x: frame.maxX - 90, y: frame.midY))
            self.panel = panel
        }
        // Recover a companion stranded by an unplugged monitor.
        if let panel, !NSScreen.screens.contains(where: { $0.visibleFrame.intersects(panel.frame) }), let screen = NSScreen.main {
            panel.setFrameOrigin(CGPoint(x: screen.visibleFrame.maxX - 90, y: screen.visibleFrame.midY))
        }
        panel?.orderFrontRegardless()
        if greeting { showBubble(title: "Truly is ready.", message: "Drag me beside your work. Click to share that screen.") }
    }

    func showLearningReady(
        title: String,
        workspaceLink: DesktopLearningSession.LearningLink?,
        onOpen: @escaping (DesktopLearningSession.LearningLink) -> Void
    ) {
        show()
        showBubble(
            title: title,
            message: "Ready to begin on this Mac.",
            actionLabel: workspaceLink.map { "Open \($0.host)" },
            action: workspaceLink.map { link in { onOpen(link) } },
            size: CGSize(width: 280, height: workspaceLink == nil ? 90 : 128)
        )
    }

    func hide() { dismissGreeting(); panel?.orderOut(nil) }

    private func showBubble(
        title: String,
        message: String,
        actionLabel: String? = nil,
        action: (() -> Void)? = nil,
        size: CGSize = CGSize(width: 300, height: 112)
    ) {
        dismissGreeting()
        guard panel != nil else { return }
        let bubble = makePanel(size: size)
        bubble.ignoresMouseEvents = false
        bubble.becomesKeyOnlyIfNeeded = true
        bubble.contentView = NSHostingView(rootView:
            CompanionNoticeView(title: title, message: message, actionLabel: actionLabel, action: action) { [weak self] in self?.dismissGreeting() }
            .frame(width: size.width, height: size.height)
        )
        bubble.orderFrontRegardless()
        greetingPanel = bubble
        positionNoticeBesideCompanion()
    }

    private func dismissGreeting() {
        greetingPanel?.orderOut(nil); greetingPanel = nil
    }

    private func positionNoticeBesideCompanion() {
        guard let panel, let greetingPanel,
              let screen = panel.screen?.visibleFrame ?? NSScreen.main?.visibleFrame else { return }
        let bubbleSize = greetingPanel.frame.size
        var x = panel.frame.minX - bubbleSize.width - 8
        if x < screen.minX + 8 { x = panel.frame.maxX + 8 }
        let y = min(max(panel.frame.midY - bubbleSize.height / 2, screen.minY + 8), screen.maxY - bubbleSize.height - 8)
        greetingPanel.setFrameOrigin(CGPoint(x: x, y: y))
    }

    private func makePanel(size: CGSize) -> NSPanel {
        let panel = NSPanel(contentRect: CGRect(origin: .zero, size: size),
                            styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.level = .floating
        panel.hidesOnDeactivate = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.isReleasedWhenClosed = false
        return panel
    }
}

@MainActor
private final class CompanionHitView: NSView {
    var onInvoke: ((CGPoint) -> Void)?
    var onMove: ((CGPoint) -> Void)?
    private var startMouse = CGPoint.zero
    private var startOrigin = CGPoint.zero
    private var moved = false
    override var acceptsFirstResponder: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func accessibilityPerformPress() -> Bool {
        guard let window else { return false }
        onInvoke?(CGPoint(x: window.frame.midX, y: window.frame.midY))
        return true
    }

    override func draw(_ dirtyRect: NSRect) {
        let arrow = NSBezierPath()
        arrow.move(to: CGPoint(x: 10, y: 34))
        arrow.line(to: CGPoint(x: 31, y: 18))
        arrow.line(to: CGPoint(x: 21, y: 16))
        arrow.line(to: CGPoint(x: 16, y: 6))
        arrow.close()
        NSColor(red: 0.078, green: 0.478, blue: 0.463, alpha: 1).setFill()
        let shadow = NSShadow(); shadow.shadowColor = NSColor.black.withAlphaComponent(0.18)
        shadow.shadowBlurRadius = 5; shadow.shadowOffset = CGSize(width: 0, height: -1)
        NSGraphicsContext.saveGraphicsState(); shadow.set(); arrow.fill(); NSGraphicsContext.restoreGraphicsState()
        NSColor.white.withAlphaComponent(0.85).setStroke(); arrow.lineWidth = 1; arrow.stroke()
    }

    override func mouseDown(with event: NSEvent) {
        startMouse = NSEvent.mouseLocation; startOrigin = window?.frame.origin ?? .zero; moved = false
    }

    override func mouseDragged(with event: NSEvent) {
        let location = NSEvent.mouseLocation
        let dx = location.x - startMouse.x, dy = location.y - startMouse.y
        guard moved || hypot(dx, dy) > 4, let window else { return }
        moved = true
        let frame = NSScreen.screens.first(where: { $0.frame.contains(location) })?.visibleFrame
            ?? window.screen?.visibleFrame ?? CGRect(x: 0, y: 0, width: 1000, height: 700)
        let origin = CGPoint(x: min(max(startOrigin.x + dx, frame.minX), frame.maxX - 40),
                             y: min(max(startOrigin.y + dy, frame.minY), frame.maxY - 44))
        window.setFrameOrigin(origin)
        onMove?(origin)
    }

    override func mouseUp(with event: NSEvent) {
        if !moved { onInvoke?(NSEvent.mouseLocation) }
    }

    override func resetCursorRects() { addCursorRect(bounds, cursor: .pointingHand) }
}

private struct CompanionNoticeView: View {
    let title: String
    let message: String
    let actionLabel: String?
    let action: (() -> Void)?
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 8) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .lineLimit(2)
                Spacer(minLength: 6)
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 9, weight: .semibold))
                        .frame(width: 22, height: 22)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .foregroundStyle(TrulyTheme.muted)
                .help("Close")
                .accessibilityLabel("Close Truly message")
            }
            Text(message)
                .font(.system(size: 12))
                .foregroundStyle(TrulyTheme.muted)
                .fixedSize(horizontal: false, vertical: true)
            if let actionLabel, let action {
                Button(actionLabel) {
                    action()
                    onClose()
                }
                .buttonStyle(TrulySecondaryButtonStyle())
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(TrulyTheme.border.opacity(0.72), lineWidth: 0.8)
                )
                .shadow(color: .black.opacity(0.12), radius: 14, y: 6)
        )
        .foregroundStyle(TrulyTheme.ink)
        .environment(\.colorScheme, .light)
    }
}
