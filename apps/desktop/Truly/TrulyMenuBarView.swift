import AppKit
import SwiftUI

struct TrulyMenuBarView: View {
    @ObservedObject var controller: DesktopAppController
    @EnvironmentObject private var learning: LearningSessionModel
    @EnvironmentObject private var pairing: DevicePairingModel
    @ObservedObject private var voice: LocalVoiceService

    init(controller: DesktopAppController) {
        self.controller = controller
        self.voice = controller.voice
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                TrulyBrandMark(size: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Truly").font(.system(size: 14, weight: .semibold))
                    Text(pairing.state == .paired ? "Connected to your phone" : "Mac companion")
                        .font(.system(size: 11)).foregroundStyle(TrulyTheme.muted)
                }
                Spacer()
                Circle()
                    .fill(pairing.state == .paired ? TrulyTheme.teal : TrulyTheme.muted.opacity(0.35))
                    .frame(width: 7, height: 7)
                    .accessibilityLabel(pairing.state.label)
            }

            if let session = learning.activeLearningSession {
                Button(action: controller.openTaskPanel) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(session.source.title).font(.system(size: 12, weight: .medium)).lineLimit(1)
                        Text(session.status == "completed" ? "Complete · AI-checked" : "Step \(session.currentStep.index) of \(session.currentStep.total)")
                            .font(.system(size: 10)).foregroundStyle(TrulyTheme.muted)
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(TrulyTheme.canvas, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                }
                .buttonStyle(TrulyMenuActionStyle())
            } else if pairing.state == .paired {
                Text("Choose a Task or Path in Truly on your phone to begin.")
                    .font(.system(size: 11)).foregroundStyle(TrulyTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack {
                Text("Input").font(.system(size: 11))
                Spacer()
                Picker("Input", selection: Binding(get: { controller.inputMode }, set: { controller.setInputMode($0) })) {
                    ForEach(TrulyInputMode.allCases) { Text($0.rawValue).tag($0) }
                }.pickerStyle(.segmented).labelsHidden().frame(width: 150)
            }
            if controller.inputMode == .voice {
                HStack {
                    Text("Reply").font(.system(size: 11))
                    Spacer()
                    Picker("Reply", selection: Binding(get: { learning.readRepliesAloud }, set: { learning.setReadRepliesAloud($0) })) {
                        Text("Text").tag(false)
                        Text("Spoken").tag(true)
                    }.pickerStyle(.segmented).labelsHidden().frame(width: 150)
                }
                HStack(alignment: .top, spacing: 8) {
                    Text(controller.voiceAvailability).font(.system(size: 10))
                        .foregroundStyle(TrulyTheme.muted).fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 4)
                    if case .unavailable = voice.state {
                        Button("Retry", action: controller.retryVoice).buttonStyle(TrulyMenuActionStyle())
                    } else {
                        Button(controller.voicePaused ? "Resume" : "Pause", action: controller.toggleVoicePause).buttonStyle(TrulyMenuActionStyle())
                    }
                }
                Button("Record a question", action: controller.recordVoiceQuestion)
                    .buttonStyle(TrulyMenuActionStyle()).font(.system(size: 11))
                    .disabled(!controller.canRecordQuestion)
                    .help("Deliberately records one question for transcription with Groq, without wake detection")
            }
            Divider()
            HStack {
                Button("Open Task", action: controller.openTaskPanel).buttonStyle(TrulyMenuActionStyle())
                    .disabled(pairing.activeLearningSession == nil)
                Spacer()
                Button("Ask Truly", action: controller.openWorkspace).buttonStyle(TrulyMenuActionStyle())
            }
            Button(controller.companionVisible ? "Hide companion" : "Show companion", action: controller.toggleCompanion).buttonStyle(TrulyMenuActionStyle())
            HStack {
                Button("Settings…", action: controller.openSettings).buttonStyle(TrulyMenuActionStyle())
                Spacer()
                Button("Quit") { NSApp.terminate(nil) }.buttonStyle(TrulyMenuActionStyle())
            }
        }
        .padding(16)
        .frame(width: 300, alignment: .leading)
        .font(.system(size: 13))
        .foregroundStyle(TrulyTheme.ink)
        .background(TrulyTheme.surface)
        .environment(\.colorScheme, .light)
        .preferredColorScheme(.light)
        .onAppear { learning.refreshPermissions() }
    }

}

/// Native-sized actions with hover and press feedback, without layout shifts or animation.
private struct TrulyMenuActionStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        MenuActionBody(configuration: configuration)
    }

    private struct MenuActionBody: View {
        let configuration: ButtonStyle.Configuration
        @State private var hovered = false
        @Environment(\.isEnabled) private var enabled

        var body: some View {
            configuration.label
                .padding(.horizontal, 5)
                .padding(.vertical, 3)
                .overlay(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(enabled && configuration.isPressed ? TrulyTheme.teal.opacity(0.16)
                              : enabled && hovered ? TrulyTheme.teal.opacity(0.08) : .clear)
                        .allowsHitTesting(false)
                )
                .contentShape(Rectangle())
                .opacity(enabled ? 1 : 0.45)
                .onHover { inside in
                    hovered = inside
                    if inside && enabled { NSCursor.pointingHand.set() }
                    else { NSCursor.arrow.set() }
                }
                .onChange(of: enabled) { _, value in
                    if hovered { (value ? NSCursor.pointingHand : NSCursor.arrow).set() }
                }
        }
    }
}

struct TrulyTaskPanelView: View {
    enum Section: String, CaseIterable, Identifiable { case overview = "Overview", resources = "Resources"; var id: String { rawValue } }
    @ObservedObject var controller: DesktopAppController
    @EnvironmentObject private var pairing: DevicePairingModel
    @State private var section: Section = .overview
    @EnvironmentObject private var learning: LearningSessionModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let session = learning.activeLearningSession {
                VStack(alignment: .leading, spacing: 5) {
                    Text(session.source.kind == "task" ? "Private Task" : (session.source.creatorName.map { "Path by \($0)" } ?? "Creator Path"))
                        .font(.system(size: 10, weight: .semibold)).foregroundStyle(TrulyTheme.tealDark)
                    Text(session.source.title).font(.system(size: 21, weight: .semibold)).lineLimit(2)
                }

                Picker("Task section", selection: $section) {
                    ForEach(Section.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .labelsHidden()

                ScrollView {
                    if section == .overview { overview(session) } else { resources(session) }
                }
            } else {
                ContentUnavailableView("Nothing active", systemImage: "checklist", description: Text("Start a Task or Path from Truly on your phone."))
            }
        }
        .padding(20)
        .frame(minWidth: 390, minHeight: 420, alignment: .topLeading)
        .background(TrulyTheme.surface)
        .environment(\.colorScheme, .light)
        .preferredColorScheme(.light)
    }

    private func overview(_ session: DesktopLearningSession) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text(session.status == "completed" ? "Task complete" : "Step \(session.currentStep.index) of \(session.currentStep.total)")
                    .font(.system(size: 10, weight: .semibold)).foregroundStyle(TrulyTheme.muted)
                Text(session.currentStep.title).font(.system(size: 16, weight: .semibold))
                Text(session.currentStep.summary).font(.system(size: 12)).foregroundStyle(TrulyTheme.text)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(TrulyTheme.canvas, in: RoundedRectangle(cornerRadius: 11, style: .continuous))

            if let link = session.preferredWorkspaceLink {
                VStack(alignment: .leading, spacing: 7) {
                    Text("Starting point").font(.system(size: 11, weight: .semibold))
                    Text(link.title).font(.system(size: 12))
                    Text(link.host).font(.system(size: 10)).foregroundStyle(TrulyTheme.muted)
                    Button("Open \(link.host)") { controller.openExternalLink(link) }
                        .buttonStyle(TrulyPrimaryButtonStyle())
                        .help(link.url)
                }
            }

            if let progress = session.progress {
                Text("\(progress.completedCount) of \(progress.total) steps complete · AI-checked")
                    .font(.system(size: 11)).foregroundStyle(TrulyTheme.muted)
            }
            if let challenge = session.currentStep.challenge {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Practice goal").font(.system(size: 11, weight: .semibold))
                    Text(challenge).font(.system(size: 12)).foregroundStyle(TrulyTheme.text)
                    ForEach(session.currentStep.rubric ?? [], id: \.self) { criterion in
                        Text("• \(criterion)").font(.system(size: 11)).foregroundStyle(TrulyTheme.text)
                    }
                    Text("Show your own work, not a tutorial. Check my work shares one fresh screen with Groq. AI checks can be wrong; this is not certification.")
                        .font(.system(size: 10)).foregroundStyle(TrulyTheme.muted)
                    Button(learning.phase == .evaluatingAttempt ? "Checking…" : "Check my work") { controller.checkPractice() }
                        .buttonStyle(TrulyPrimaryButtonStyle()).disabled(!learning.canCheckPractice)
                    if !learning.processorConsentGranted {
                        Button("Allow AI help") { controller.openSettings() }.buttonStyle(.plain)
                    }
                }
            }
            if case .failed(let message) = learning.phase {
                Text(message).font(.system(size: 12)).foregroundStyle(TrulyTheme.text)
                    .fixedSize(horizontal: false, vertical: true)
            } else if !learning.practiceMessage.isEmpty {
                Text(learning.practiceMessage).font(.system(size: 12)).foregroundStyle(TrulyTheme.text)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func resources(_ session: DesktopLearningSession) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if session.availableResources.isEmpty {
                Text("No supporting resources for this step.")
                    .font(.system(size: 12)).foregroundStyle(TrulyTheme.muted)
            } else {
                ForEach(session.availableResources) { link in
                    Button { controller.openExternalLink(link) } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "link").foregroundStyle(TrulyTheme.tealDark)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(link.title).font(.system(size: 12, weight: .medium))
                                Text(link.host).font(.system(size: 10)).foregroundStyle(TrulyTheme.muted)
                            }
                            Spacer()
                            Image(systemName: "arrow.up.right").font(.system(size: 10))
                        }
                        .padding(12)
                        .background(TrulyTheme.canvas, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .help(link.url)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct TrulySettingsView: View {
    @ObservedObject var controller: DesktopAppController
    enum Section: String, CaseIterable, Identifiable { case connection = "Connection", privacy = "Privacy"; var id: String { rawValue } }
    @EnvironmentObject private var learning: LearningSessionModel
    @EnvironmentObject private var pairing: DevicePairingModel
    @State private var section: Section = .connection

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 10) {
                TrulyBrandMark(size: 30)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Truly Settings").font(.system(size: 17, weight: .semibold))
                    Text("Connection and privacy controls").font(.system(size: 11)).foregroundStyle(TrulyTheme.muted)
                }
            }
            Picker("Settings section", selection: $section) { ForEach(Section.allCases) { Text($0.rawValue).tag($0) } }
                .pickerStyle(.segmented).labelsHidden()
            ScrollView { if section == .connection { connection } else { privacy } }
        }
        .padding(22)
        .frame(minWidth: 420, minHeight: 480, alignment: .topLeading)
        .background(TrulyTheme.surface)
        .environment(\.colorScheme, .light)
        .preferredColorScheme(.light)
        .onAppear { learning.refreshPermissions() }
    }

    private var connection: some View {
        VStack(alignment: .leading, spacing: 14) {
            settingsCard(title: "Phone connection") {
                Text(pairing.state.label).font(.system(size: 13, weight: .semibold))
                if let address = pairing.walletAddress {
                    Text("\(address.prefix(8))…\(address.suffix(5))").font(.system(size: 11)).foregroundStyle(TrulyTheme.tealDark)
                    Text("Manage or revoke this Mac from Truly → Devices on your phone.").font(.system(size: 11)).foregroundStyle(TrulyTheme.muted)
                }
                if let code = pairing.pairingCode {
                    Text(code).font(.system(size: 24, weight: .semibold, design: .monospaced)).tracking(3).textSelection(.enabled)
                    Text("Enter this in Truly → Devices on your phone. It is valid for five minutes.").font(.system(size: 11)).foregroundStyle(TrulyTheme.muted)
                    Button("Cancel pairing", action: pairing.reset).buttonStyle(TrulySecondaryButtonStyle())
                } else {
                    Button(pairing.state == .creating ? "Checking…" : (pairing.state == .paired ? "Create new pairing code" : "Pair this Mac"), action: pairing.createCode)
                        .buttonStyle(TrulyPrimaryButtonStyle()).disabled(pairing.state == .creating)
                }
                if case .failed(let message) = pairing.state {
                    Text(message).font(.system(size: 11)).foregroundStyle(TrulyTheme.text)
                    if pairing.coreUnavailable {
                        Button("Retry connection", action: pairing.retryConnection).buttonStyle(TrulySecondaryButtonStyle())
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var privacy: some View {
        VStack(alignment: .leading, spacing: 14) {
            settingsCard(title: "Screen sharing") {
                Text("Truly sees one screen when you click the companion or finish a ‘Hey Truly’ question. It never watches continuously.")
                    .font(.system(size: 11)).foregroundStyle(TrulyTheme.muted)
                if !learning.screenPermissionGranted {
                    Button("Allow Screen Recording", action: learning.requestScreenPermission).buttonStyle(TrulyPrimaryButtonStyle())
                }
                Button("Open macOS settings") {
                    if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture") { NSWorkspace.shared.open(url) }
                }.buttonStyle(TrulySecondaryButtonStyle())
            }
            settingsCard(title: "AI help") {
                Text(learning.processorConsentGranted ? "AI help is on for screens you deliberately send." : "AI help is off. Truly asks before sending a shared screen.")
                    .font(.system(size: 11)).foregroundStyle(TrulyTheme.muted)
                if learning.processorConsentGranted {
                    Button("Turn off AI help", action: learning.revokeProcessorConsent).buttonStyle(TrulySecondaryButtonStyle())
                } else {
                    Text("Only the screen or recording you deliberately submit is sent to Groq. Truly does not save either one.")
                        .font(.system(size: 11)).foregroundStyle(TrulyTheme.muted)
                    Button("Allow AI help", action: learning.approveProcessor).buttonStyle(TrulySecondaryButtonStyle())
                        .disabled(learning.activeLearningSession == nil)
                }
                Text("Voice mode listens locally for ‘Hey Truly’. Completed questions share one screen and question text with Groq. Record a question sends only that requested recording to Groq, then discards it. Pause or hide the companion to stop listening.")
                    .font(.system(size: 11)).foregroundStyle(TrulyTheme.muted)
                Button("Reset hands-free permission", action: controller.revokeWakeConsent).buttonStyle(TrulySecondaryButtonStyle())
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func settingsCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.system(size: 13, weight: .semibold))
            content()
        }
        .padding(15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TrulyTheme.canvas, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
