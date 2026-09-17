import AppKit
import SwiftUI

struct TrulyMenuBarView: View {
    @ObservedObject var controller: DesktopAppController
    @EnvironmentObject private var learning: LearningSessionModel
    @EnvironmentObject private var pairing: DevicePairingModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
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

            connectionSummary

            if let session = pairing.activeLearningSession {
                Button(action: controller.openTaskPanel) {
                    VStack(alignment: .leading, spacing: 5) {
                        HStack {
                            Text(session.source.kind == "task" ? "CURRENT TASK" : "CURRENT PATH")
                                .font(.system(size: 9, weight: .semibold)).tracking(0.45)
                                .foregroundStyle(TrulyTheme.tealDark)
                            Spacer()
                            Image(systemName: "chevron.right").font(.system(size: 9, weight: .semibold))
                        }
                        Text(session.source.title).font(.system(size: 12, weight: .semibold)).lineLimit(2)
                        Text("Step \(session.currentStep.index) of \(session.currentStep.total) · \(session.currentStep.title)")
                            .font(.system(size: 10)).foregroundStyle(TrulyTheme.muted).lineLimit(2)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(TrulyTheme.tealPale, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
                .trulyPointingCursor()
            } else if pairing.state == .paired {
                Text("Choose a Task or Path in Truly on your phone to begin.")
                    .font(.system(size: 11)).foregroundStyle(TrulyTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack(spacing: 8) {
                Button(controller.companionVisible ? "Hide companion" : "Show companion", action: controller.toggleCompanion)
                    .buttonStyle(TrulySecondaryButtonStyle())
                Button("Ask Truly", action: controller.openWorkspace)
                    .buttonStyle(TrulySecondaryButtonStyle())
            }

            Toggle("Read replies aloud", isOn: Binding(
                get: { learning.readRepliesAloud },
                set: { learning.setReadRepliesAloud($0) }
            ))
            .toggleStyle(.switch)
            .font(.system(size: 12))

            Divider()
            Button("Settings…", action: controller.openSettings).buttonStyle(.plain)
            Button("Quit Truly") { NSApp.terminate(nil) }.buttonStyle(.plain)
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

    @ViewBuilder
    private var connectionSummary: some View {
        if pairing.state == .paired {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Mac paired").font(.system(size: 11, weight: .medium))
                    Text(shortAddress).font(.system(size: 10)).foregroundStyle(TrulyTheme.muted)
                }
                Spacer()
                Button("Manage", action: controller.openSettings).buttonStyle(.plain)
                    .font(.system(size: 10, weight: .semibold)).foregroundStyle(TrulyTheme.tealDark)
            }
        } else {
            HStack(alignment: .center, spacing: 10) {
                Text(pairing.state.label).font(.system(size: 11)).foregroundStyle(TrulyTheme.muted)
                Spacer()
                Button("Connect this Mac", action: controller.openSettings).buttonStyle(.plain)
                    .font(.system(size: 10, weight: .semibold)).foregroundStyle(TrulyTheme.tealDark)
            }
        }
    }

    private var shortAddress: String {
        pairing.walletAddress.map { "\($0.prefix(8))…\($0.suffix(5))" } ?? "Wallet connected"
    }
}

struct TrulyTaskPanelView: View {
    enum Section: String, CaseIterable, Identifiable { case overview = "Overview", resources = "Resources"; var id: String { rawValue } }
    @ObservedObject var controller: DesktopAppController
    @EnvironmentObject private var pairing: DevicePairingModel
    @State private var section: Section = .overview

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let session = pairing.activeLearningSession {
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
                Text("Step \(session.currentStep.index) of \(session.currentStep.total)")
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

            if let challenge = session.currentStep.challenge {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Challenge").font(.system(size: 11, weight: .semibold))
                    Text(challenge).font(.system(size: 12)).foregroundStyle(TrulyTheme.text)
                }
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
                Text("Truly sees one screen only when you click the companion. It does not watch in the background.")
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
                }
                Toggle("Read replies aloud", isOn: Binding(get: { learning.readRepliesAloud }, set: { learning.setReadRepliesAloud($0) }))
                    .toggleStyle(.switch)
                Text("Voice records only while you hold the microphone. Audio is discarded after transcription.")
                    .font(.system(size: 11)).foregroundStyle(TrulyTheme.muted)
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
