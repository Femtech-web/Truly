import AppKit
import SwiftUI

@MainActor
final class PointerOverlayController {
    private let viewModel = PointerOverlayViewModel()
    private var overlayPanel: NSPanel?
    private var hostingView: NSHostingView<TrulyPointerOverlay>?
    private var revealTask: Task<Void, Never>?
    private var targetPoint = CGPoint.zero
    private var displayFrame = CGRect.zero
    private var manuallyPositioned = false

    func showResponse(
        normalizedX: CGFloat?,
        normalizedY: CGFloat?,
        on displayFrame: CGRect,
        message: String
    ) {
        revealTask?.cancel()
        manuallyPositioned = false
        self.displayFrame = displayFrame
        targetPoint = resolvedPoint(
            normalizedX: normalizedX,
            normalizedY: normalizedY,
            displayFrame: displayFrame
        )

        viewModel.displayedText = ""
        viewModel.isWriting = true
        let initialSize = desiredPanelSize(for: "")
        let destinationOrigin = validatedPanelOrigin(
            around: targetPoint,
            panelSize: initialSize,
            displayFrame: displayFrame
        )
        let startOrigin = validatedPanelOrigin(
            around: NSEvent.mouseLocation,
            panelSize: initialSize,
            displayFrame: displayFrame
        )

        let panel = overlayPanel ?? makePanel(size: initialSize)
        overlayPanel = panel
        configureContentIfNeeded(for: panel)
        setPanelSize(initialSize, reposition: false)
        panel.alphaValue = 0
        panel.setFrameOrigin(startOrigin)
        panel.orderFrontRegardless()

        NSAnimationContext.runAnimationGroup { context in
            context.duration = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? 0.01 : 0.16
            panel.animator().alphaValue = 1
        }

        revealTask = Task { @MainActor [weak self] in
            guard let self else { return }
            if NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
                panel.setFrameOrigin(destinationOrigin)
            } else {
                // Interruptible travel: a learner's drag always wins over automatic positioning.
                for tick in 1...24 {
                    guard !Task.isCancelled else { return }
                    if self.manuallyPositioned { break }
                    let fraction = CGFloat(tick) / 24
                    let eased = fraction * fraction * (3 - 2 * fraction)
                    panel.setFrameOrigin(CGPoint(
                        x: startOrigin.x + (destinationOrigin.x - startOrigin.x) * eased,
                        y: startOrigin.y + (destinationOrigin.y - startOrigin.y) * eased
                    ))
                    try? await Task.sleep(for: .milliseconds(16))
                }
            }
            let pieces = Self.revealPieces(from: message)
            for piece in pieces {
                guard !Task.isCancelled else { return }
                self.viewModel.displayedText.append(piece)
                self.setPanelSize(self.desiredPanelSize(for: self.viewModel.displayedText), reposition: true)
                if !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
                    try? await Task.sleep(for: Self.delay(after: piece))
                }
            }
            guard !Task.isCancelled else { return }
            self.viewModel.isWriting = false
            self.setPanelSize(self.desiredPanelSize(for: self.viewModel.displayedText), reposition: true)
            self.revealTask = nil
        }
    }

    func hidePointer() {
        revealTask?.cancel()
        revealTask = nil
        viewModel.displayedText = ""
        viewModel.isWriting = false
        overlayPanel?.orderOut(nil)
    }

    private func configureContentIfNeeded(for panel: NSPanel) {
        guard hostingView == nil else { return }
        let root = TrulyPointerOverlay(
            viewModel: viewModel,
            onMove: { [weak self] origin in
                self?.manuallyPositioned = true
                self?.overlayPanel?.setFrameOrigin(origin)
            },
            onClose: { [weak self] in self?.hidePointer() }
        )
        let hostingView = NSHostingView(rootView: root)
        panel.contentView = hostingView
        self.hostingView = hostingView
    }

    private func makePanel(size: CGSize) -> NSPanel {
        let panel = NSPanel(
            contentRect: CGRect(origin: .zero, size: size),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.level = .statusBar
        panel.ignoresMouseEvents = false
        panel.becomesKeyOnlyIfNeeded = true
        panel.hidesOnDeactivate = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.isReleasedWhenClosed = false
        return panel
    }

    private func setPanelSize(_ size: CGSize, reposition: Bool) {
        guard let panel = overlayPanel else { return }
        var frame = panel.frame
        let previousTop = frame.maxY
        frame.size = size
        if reposition {
            if manuallyPositioned {
                // Keep the dragged header steady while more words grow beneath it.
                let visible = panel.screen?.visibleFrame ?? displayFrame
                frame.origin = CGPoint(
                    x: min(max(frame.minX, visible.minX + 8), max(visible.minX + 8, visible.maxX - size.width - 8)),
                    y: min(max(previousTop - size.height, visible.minY + 8), max(visible.minY + 8, visible.maxY - size.height - 8))
                )
            } else {
                frame.origin = validatedPanelOrigin(around: targetPoint, panelSize: size, displayFrame: displayFrame)
            }
        }
        panel.setFrame(frame, display: true, animate: false)
        hostingView?.frame = CGRect(origin: .zero, size: size)
    }

    private func desiredPanelSize(for text: String) -> CGSize {
        let maximumTextWidth: CGFloat = 310
        let font = NSFont.systemFont(ofSize: 13, weight: .regular)
        let measuringText = text.isEmpty ? "Truly is writing…" : text
        let bounds = (measuringText as NSString).boundingRect(
            with: CGSize(width: maximumTextWidth, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: [.font: font]
        )
        let textWidth = min(max(150, ceil(bounds.width)), maximumTextWidth)
        let cardWidth = min(max(214, textWidth + 36), 348)
        let cardHeight = min(max(64, ceil(bounds.height) + 48), 300)
        return CGSize(width: cardWidth + 82, height: max(84, cardHeight + 20))
    }

    private func resolvedPoint(
        normalizedX: CGFloat?,
        normalizedY: CGFloat?,
        displayFrame: CGRect
    ) -> CGPoint {
        guard let normalizedX, let normalizedY else {
            let mouse = NSEvent.mouseLocation
            return CGPoint(
                x: min(max(mouse.x, displayFrame.minX + 24), displayFrame.maxX - 24),
                y: min(max(mouse.y, displayFrame.minY + 24), displayFrame.maxY - 24)
            )
        }
        let clampedX = min(max(normalizedX, 0.06), 0.94)
        let clampedY = min(max(normalizedY, 0.06), 0.94)
        return CGPoint(
            x: displayFrame.minX + displayFrame.width * clampedX,
            y: displayFrame.minY + displayFrame.height * clampedY
        )
    }

    private func validatedPanelOrigin(
        around point: CGPoint,
        panelSize: CGSize,
        displayFrame: CGRect
    ) -> CGPoint {
        var proposedX = point.x - 34
        var proposedY = point.y - panelSize.height / 2
        if proposedX + panelSize.width > displayFrame.maxX - 12 {
            proposedX = point.x - panelSize.width + 34
        }
        if proposedY < displayFrame.minY + 12 {
            proposedY = point.y + 18
        }
        return CGPoint(
            x: min(max(proposedX, displayFrame.minX + 12), displayFrame.maxX - panelSize.width - 12),
            y: min(max(proposedY, displayFrame.minY + 12), displayFrame.maxY - panelSize.height - 12)
        )
    }

    private static func revealPieces(from message: String) -> [String] {
        var pieces: [String] = []
        var current = ""
        for character in message {
            current.append(character)
            if character.isWhitespace {
                pieces.append(current)
                current = ""
            }
        }
        if !current.isEmpty { pieces.append(current) }
        return pieces
    }

    private static func delay(after piece: String) -> Duration {
        if piece.contains("\n") { return .milliseconds(95) }
        if piece.contains(where: { ".!?".contains($0) }) { return .milliseconds(70) }
        if piece.contains(where: { ",;:".contains($0) }) { return .milliseconds(45) }
        return .milliseconds(24)
    }
}

@MainActor
private final class PointerOverlayViewModel: ObservableObject {
    @Published var displayedText = ""
    @Published var isWriting = false
}

private struct TrulyPointerOverlay: View {
    @ObservedObject var viewModel: PointerOverlayViewModel
    let onMove: (CGPoint) -> Void
    let onClose: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            ZStack {
                PointerShape()
                    .fill(Color.white)
                    .frame(width: 17, height: 23)
                    .shadow(color: .black.opacity(0.25), radius: 3, y: 2)
                TrulyCompanionOrb(size: 30, isActive: viewModel.isWriting)
                    .offset(x: 25, y: 13)
            }
            .frame(width: 58, height: 58)

            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 8) {
                    HStack(spacing: 8) {
                        Text("Truly")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(TrulyTheme.tealDark)
                        if viewModel.isWriting {
                            Text("Writing…")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(TrulyTheme.muted)
                        }
                        Spacer(minLength: 8)
                    }
                    .frame(maxWidth: .infinity, minHeight: 20)
                    .overlay(ResponseDragHandle(onMove: onMove))
                    .help("Drag to move this answer")
                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .font(.system(size: 9, weight: .semibold))
                            .frame(width: 20, height: 20)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(TrulyTheme.muted)
                    .help("Close")
                    .accessibilityLabel("Close Truly response")
                }

                ScrollView {
                    Text(viewModel.displayedText.isEmpty ? "Thinking about what you shared…" : viewModel.displayedText)
                        .font(.system(size: 13, weight: .regular))
                        .foregroundStyle(TrulyTheme.ink)
                        .lineSpacing(3)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .scrollIndicators(.automatic)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(.white)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(TrulyTheme.border.opacity(0.72), lineWidth: 0.8)
                    )
                    .shadow(color: .black.opacity(0.14), radius: 16, y: 7)
            )
        }
        .padding(10)
        .environment(\.colorScheme, .light)
    }
}

/// Only the header handles dragging; the answer retains selection, scrolling and its close button.
private struct ResponseDragHandle: NSViewRepresentable {
    let onMove: (CGPoint) -> Void

    func makeNSView(context: Context) -> ResponseDragView {
        let view = ResponseDragView()
        view.onMove = onMove
        view.setAccessibilityElement(true)
        view.setAccessibilityRole(.group)
        view.setAccessibilityLabel("Truly answer")
        view.setAccessibilityHelp("Drag this header to move the answer. Scroll or select text below.")
        return view
    }

    func updateNSView(_ view: ResponseDragView, context: Context) { view.onMove = onMove }
}

private final class ResponseDragView: NSView {
    var onMove: ((CGPoint) -> Void)?
    private var startMouse = CGPoint.zero
    private var startOrigin = CGPoint.zero

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func mouseDown(with event: NSEvent) {
        startMouse = NSEvent.mouseLocation
        startOrigin = window?.frame.origin ?? .zero
    }

    override func mouseDragged(with event: NSEvent) {
        guard let window else { return }
        let mouse = NSEvent.mouseLocation
        let visible = NSScreen.screens.first(where: { $0.frame.contains(mouse) })?.visibleFrame
            ?? window.screen?.visibleFrame ?? window.frame
        let proposed = CGPoint(x: startOrigin.x + mouse.x - startMouse.x,
                               y: startOrigin.y + mouse.y - startMouse.y)
        onMove?(CGPoint(
            x: min(max(proposed.x, visible.minX + 8), max(visible.minX + 8, visible.maxX - window.frame.width - 8)),
            y: min(max(proposed.y, visible.minY + 8), max(visible.minY + 8, visible.maxY - window.frame.height - 8))
        ))
    }

    override func resetCursorRects() { addCursorRect(bounds, cursor: .openHand) }
}

private struct PointerShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + rect.height * 0.67))
        path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.56, y: rect.minY + rect.height * 0.72))
        path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.36, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}
