import AppKit
import SwiftUI
import Combine

@MainActor
final class DesktopAppController: NSObject, ObservableObject, NSWindowDelegate {
    let learning: LearningSessionModel
    let pairing: DevicePairingModel
    @Published private(set) var companionVisible = true
    @Published private(set) var inputMode = TrulyInputMode(rawValue: UserDefaults.standard.string(forKey: "truly.input-mode") ?? "Text") ?? .text
    @Published private(set) var voicePaused = true
    let voice = LocalVoiceService()
    private var workspace: NSWindow?
    private var taskPanel: NSWindow?
    private var settingsPanel: NSWindow?
    private var capturing = false
    private var subscriptions = Set<AnyCancellable>()
    private var voiceFocus = CGPoint.zero
    private var voiceQuestionInFlight = false
    private var voiceAnswerPending = false
    private var voiceInteraction = UUID()
    private var speaking = false
    private var coolingDown = false
    private var cooldownTask: Task<Void, Never>?
    private var voiceLaunchTask: Task<Void, Never>?
    private static let wakeConsentKey = "truly.privacy.local-wake-v1"
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
        learning.onSpeechPlaybackChanged = { [weak self] playing in
            guard let self else { return }
            speaking = playing
            cooldownTask?.cancel()
            coolingDown = !playing
            reconcileVoice()
            if !playing {
                cooldownTask = Task { [weak self] in
                    try? await Task.sleep(for: .milliseconds(700))
                    guard !Task.isCancelled, let self else { return }
                    coolingDown = false
                    reconcileVoice()
                }
            }
        }
        voice.onWake = { [weak self] in self?.voiceFocus = NSEvent.mouseLocation }
        voice.onQuestion = { [weak self] text, review in self?.askByVoice(text, requiresReview: review) }
        voice.onStateChanged = { [weak self] state in self?.companion.setVoiceState(state) }
        learning.$phase.combineLatest(learning.$processorConsentGranted, learning.$voiceState)
            .sink { [weak self] phase, _, _ in
                Task { @MainActor in
                    guard let self else { return }
                    if TrulyVoiceAnswerPresentationPolicy.shouldPresentWorkspace(answerPending: self.voiceAnswerPending, phase: phase) {
                        self.voiceAnswerPending = false
                        self.presentWorkspace()
                    } else if self.voiceAnswerPending, phase == .idle, !self.learning.response.isEmpty {
                        self.voiceAnswerPending = false
                    }
                    self.reconcileVoice()
                }
            }
            .store(in: &subscriptions)
        pairing.$state.sink { [weak self] _ in Task { @MainActor in self?.reconcileVoice() } }
            .store(in: &subscriptions)
        for name in [NSWorkspace.willSleepNotification, NSWorkspace.sessionDidResignActiveNotification] {
            NSWorkspace.shared.notificationCenter.publisher(for: name)
                .sink { [weak self] _ in
                    Task { @MainActor in
                        guard let self else { return }
                        self.voicePaused = true; self.cancelVoiceInteraction(); self.voice.stop(); self.learning.resetSession()
                    }
                }.store(in: &subscriptions)
        }
        pairing.onLearningSessionChanged = { [weak self] session, change in
            guard let self else { return }
            cancelVoiceInteraction()
            voice.stop()
            self.learning.activateLearningSession(session)
            if let session, session.status == "active", change == .updated, !learning.phase.isBusy {
                self.companion.showLearningReady(
                    title: session.source.title,
                    companionVisible: companionVisible,
                    workspaceLink: session.preferredWorkspaceLink,
                    onOpen: { [weak self] link in self?.openExternalLink(link) }
                )
            }
            reconcileVoice()
        }
    }

    func start() {
        learning.prepare()
        learning.allowsSpokenReplies = inputMode == .voice
        companion.setFollowing(inputMode == .voice)
        companion.show(greeting: true)
        learning.activateLearningSession(pairing.activeLearningSession)
        pairing.onRevoked = { [weak self] in self?.learning.activateLearningSession(nil) }
    }

    func stop() {
        voicePaused = true; voice.stop(); cancelVoiceInteraction(); cooldownTask?.cancel()
        companion.hide(); pairing.stopMonitoring(); learning.resetSession()
    }

    func toggleCompanion() {
        companionVisible.toggle()
        if companionVisible { companion.show() } else {
            voicePaused = true; cancelVoiceInteraction(); voice.stop()
            workspace?.orderOut(nil); pointer.hidePointer(); learning.resetSession(); companion.hide()
        }
        reconcileVoice()
    }

    func setInputMode(_ mode: TrulyInputMode) {
        guard mode != inputMode else { return }
        cancelVoiceInteraction(); voice.stop(); learning.resetSession()
        workspace?.orderOut(nil); pointer.hidePointer()
        inputMode = mode
        learning.allowsSpokenReplies = mode == .voice
        UserDefaults.standard.set(mode.rawValue, forKey: "truly.input-mode")
        voicePaused = true
        companion.setFollowing(mode == .voice)
        if mode == .voice { toggleVoicePause() }
    }

    func toggleVoicePause() {
        guard inputMode == .voice else { return }
        if !voicePaused {
            voicePaused = true; cancelVoiceInteraction(); voice.stop(); learning.resetSession()
            return
        }
        if !UserDefaults.standard.bool(forKey: Self.wakeConsentKey) {
            let alert = NSAlert()
            alert.messageText = "Enable hands-free voice?"
            alert.informativeText = "Your Mac will listen locally for ‘Hey Truly’ while voice is active. A completed question sends one screen and the question text to Groq. Ambient audio is not uploaded. Other people or media can trigger the phrase. Pause voice anytime from the Truly menu."
            alert.addButton(withTitle: "Enable voice")
            alert.addButton(withTitle: "Not now")
            guard alert.runModal() == .alertFirstButtonReturn else { return }
            UserDefaults.standard.set(true, forKey: Self.wakeConsentKey)
        }
        voicePaused = false
        // A manual retry clears an unavailable state; it is never retried in a loop.
        voice.stop()
        reconcileVoice()
    }

    func retryVoice() { voicePaused = true; toggleVoicePause() }

    func revokeWakeConsent() {
        setInputMode(.text)
        voicePaused = true; cancelVoiceInteraction(); voice.stop()
        UserDefaults.standard.removeObject(forKey: Self.wakeConsentKey)
    }

    private func reconcileVoice() {
        let eligibility = TrulyVoiceEligibility(mode: inputMode, paused: voicePaused, visible: companionVisible,
            paired: pairing.state == .paired, hasTask: learning.activeLearningSession?.status == "active",
            processorApproved: learning.processorConsentGranted,
            wakeApproved: UserDefaults.standard.bool(forKey: Self.wakeConsentKey))
        guard eligibility.canListen else {
            if voice.state != .paused { voice.stop() }
            if !learning.processorConsentGranted || pairing.state != .paired || learning.activeLearningSession?.status != "active" {
                cancelVoiceInteraction()
            }
            return
        }
        if speaking { voice.stop(as: .speaking); return }
        if coolingDown || voiceQuestionInFlight || capturing || learning.phase.isBusy || learning.voiceState.isBusy {
            if voice.state != .working { voice.stop(as: .working) }
            return
        }
        if workspace?.isVisible == true {
            if voice.state != .paused { voice.stop() }
            return
        }
        if case .unavailable = voice.state { return }
        if voice.state == .finalizing { return }
        if voice.state == .working || voice.state == .speaking { voice.stop() }
        if voice.state == .paused { voice.start() }
    }

    private func cancelVoiceInteraction() {
        voiceInteraction = UUID()
        voiceLaunchTask?.cancel(); voiceLaunchTask = nil
        voiceQuestionInFlight = false
        voiceAnswerPending = false
    }

    private func askByVoice(_ text: String, requiresReview: Bool) {
        guard inputMode == .voice, !voicePaused, companionVisible, pairing.state == .paired,
              learning.processorConsentGranted, let session = learning.activeLearningSession, session.status == "active" else { voice.stop(); return }
        let interaction = voiceInteraction
        let point = voiceFocus
        voiceQuestionInFlight = true
        let appName = NSWorkspace.shared.frontmostApplication?.localizedName ?? "Shared screen"
        voiceLaunchTask = Task { [weak self] in
            guard let self else { return }
            await learning.shareContext(at: point, appName: appName)
            guard !Task.isCancelled, interaction == voiceInteraction, !voicePaused,
                  inputMode == .voice, companionVisible, pairing.state == .paired,
                  learning.activeLearningSession?.id == session.id, learning.processorConsentGranted else { return }
            learning.question = text
            if let mode = TrulyWakePhrase.teachingMode(for: text) { learning.selectedMode = mode }
            voiceQuestionInFlight = false
            if requiresReview || learning.capturedScreen == nil {
                learning.voiceState = .failed("Check what Truly heard, then press Ask—or try saying it again.")
                presentWorkspace()
            }
            else {
                voiceAnswerPending = true
                learning.submitQuestion()
            }
            reconcileVoice()
        }
    }

    /// Explicit cloud-recording fallback. Never begins because local recognition failed.
    func recordVoiceQuestion() {
        guard inputMode == .voice, canRecordQuestion else { return }
        voicePaused = true; voice.stop(); cancelVoiceInteraction()
        let point = NSEvent.mouseLocation
        let interaction = voiceInteraction
        let session = learning.activeLearningSession?.id
        capturing = true
        voiceLaunchTask = Task {
            await learning.shareContext(at: point, appName: "Your spoken question")
            capturing = false
            guard !Task.isCancelled, interaction == voiceInteraction,
                  inputMode == .voice, companionVisible, learning.processorConsentGranted,
                  learning.activeLearningSession?.id == session, pairing.state == .paired else { return }
            presentWorkspace()
            learning.beginVoice(automaticEnd: true)
        }
    }

    var voiceAvailability: String {
        if pairing.state != .paired { return "Connect this Mac in Settings to use voice." }
        if learning.activeLearningSession?.status != "active" { return "Start a Task from your phone to use voice." }
        if !learning.processorConsentGranted { return "Allow AI help in Settings → Privacy to use voice." }
        return voice.state.label
    }

    var canRecordQuestion: Bool {
        companionVisible && pairing.state == .paired && learning.activeLearningSession?.status == "active" && learning.processorConsentGranted &&
            !learning.phase.isBusy && !learning.voiceState.isBusy && !capturing && !voiceQuestionInFlight
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
        cancelVoiceInteraction()
        voice.stop()
        presentWorkspace()
    }

    private func presentWorkspace() {
        voice.stop()
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
                .environmentObject(learning)
                .environmentObject(pairing))
            window.center()
            taskPanel = window
        }
        NSApp.activate(ignoringOtherApps: true)
        taskPanel?.makeKeyAndOrderFront(nil)
    }

    func checkPractice() {
        guard learning.canCheckPractice, !capturing, pairing.state == .paired else { return }
        voicePaused = true
        cancelVoiceInteraction()
        voice.stop()
        pointer.hidePointer()
        taskPanel?.orderOut(nil)
        workspace?.orderOut(nil)
        capturing = true
        let expected = learning.activeLearningSession
        let interaction = voiceInteraction
        let point = NSEvent.mouseLocation
        voiceLaunchTask = Task {
            await learning.shareContext(at: point, appName: "Your practice work")
            capturing = false
            guard !Task.isCancelled, interaction == voiceInteraction, companionVisible, pairing.state == .paired,
                  learning.activeLearningSession == expected else { return }
            guard learning.capturedScreen != nil else { openTaskPanel(); return }
            learning.checkPractice()
        }
    }

    func openSettings() {
        if settingsPanel == nil {
            let window = NSPanel(contentRect: CGRect(x: 0, y: 0, width: 420, height: 500),
                                 styleMask: [.titled, .closable], backing: .buffered, defer: false)
            window.title = "Truly Settings"
            window.isReleasedWhenClosed = false
            window.contentView = NSHostingView(rootView: TrulySettingsView(controller: self)
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
        cancelVoiceInteraction()
        pointer.hidePointer()
        learning.resetSession()
        if companionVisible { companion.show() }
        reconcileVoice()
    }
}

private final class CompactWorkspacePanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}
