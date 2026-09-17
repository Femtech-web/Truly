import SwiftUI

struct TrulyRootView: View {
    @EnvironmentObject private var model: LearningSessionModel
    @EnvironmentObject private var pairing: DevicePairingModel
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 8) {
                if needsAttention { statusContent } else { contextControls }
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 9, weight: .semibold))
                        .frame(width: 22, height: 22)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .foregroundStyle(TrulyTheme.muted)
                .help("Close")
                .accessibilityLabel("Close Truly")
            }

            HStack(alignment: .center, spacing: 8) {
                TextField("Ask about what you shared…", text: $model.question, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12))
                    .lineLimit(1)
                    .padding(.horizontal, 10)
                    .frame(height: 34)
                    .background(TrulyTheme.canvas, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .onSubmit { model.submitQuestion() }
                    .disabled(model.phase.isBusy || model.voiceState.isBusy)

                Button(model.phase == .responding ? "Thinking…" : "Ask", action: model.submitQuestion)
                    .buttonStyle(TrulyCompactPrimaryButtonStyle())
                    .disabled(!model.canSubmit || !model.processorConsentGranted || pairing.state != .paired || model.activeLearningSession == nil)
            }
        }
        .padding(10)
        .frame(minWidth: 480, maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(TrulyTheme.surface)
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(TrulyTheme.border.opacity(0.8), lineWidth: 0.8)
                }
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .foregroundStyle(TrulyTheme.ink)
        .environment(\.colorScheme, .light)
        .preferredColorScheme(.light)
    }

    private var contextControls: some View {
        HStack(spacing: 8) {
            Text(model.activeSourceTitle)
                .font(.system(size: 12, weight: .semibold))
                .lineLimit(1)
                .truncationMode(.tail)
                .help("Current step: \(model.activeStepTitle)")

            Spacer(minLength: 4)
            Picker("Learning mode", selection: $model.selectedMode) {
                ForEach(LearningMode.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .accessibilityLabel("Learning mode")
            .controlSize(.small)
            .frame(width: 112)
            .disabled(model.phase.isBusy || model.voiceState.isBusy)
        }
        .frame(maxWidth: .infinity)
    }

    private var needsAttention: Bool {
        if !model.screenPermissionGranted || model.capturedScreen == nil ||
            model.activeLearningSession == nil || pairing.state != .paired ||
            !model.processorConsentGranted { return true }
        if case .failed = model.phase { return true }
        if case .failed = model.voiceState { return true }
        if model.voiceState.isBusy { return true }
        return false
    }

    @ViewBuilder
    private var statusContent: some View {
        if !model.screenPermissionGranted {
            HStack(spacing: 10) {
                Text("Allow Screen Recording so Truly can see only the screen you choose.")
                    .font(.system(size: 12))
                    .foregroundStyle(TrulyTheme.text)
                Spacer(minLength: 8)
                Button("Allow", action: model.requestScreenPermission)
                    .buttonStyle(TrulySecondaryButtonStyle())
            }
        } else if model.capturedScreen == nil {
            HStack(spacing: 7) {
                Circle().fill(TrulyTheme.muted.opacity(0.45)).frame(width: 6, height: 6)
                Text("Close this bar. Click the companion in Text mode, or say ‘Hey Truly’ in Voice mode.")
                    .font(.system(size: 12))
                    .foregroundStyle(TrulyTheme.muted)
                    .lineLimit(2)
            }
        } else if model.activeLearningSession == nil {
            compactNotice("Choose a Task or Path in Truly on your phone to begin.")
        } else if pairing.state != .paired {
            compactNotice("Pair this Mac in Truly on your phone before asking for help.")
        } else if !model.processorConsentGranted {
            HStack(alignment: .center, spacing: 10) {
                Text("Only the screen or voice recording you choose to send is shared with Groq. Truly does not save either one.")
                    .font(.system(size: 12))
                    .foregroundStyle(TrulyTheme.text)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 8)
                Button("Allow AI help", action: model.approveProcessor)
                    .buttonStyle(TrulySecondaryButtonStyle())
            }
        } else if case .failed(let message) = model.phase {
            compactNotice(message)
        } else if case .failed(let message) = model.voiceState {
            compactNotice(message)
        } else if model.voiceState == .listening {
            HStack {
                compactNotice("Listening… speak your question, then pause.")
                Button("Finish", action: model.endVoice).buttonStyle(TrulySecondaryButtonStyle())
            }
        } else if model.voiceState == .transcribing {
            compactNotice("Writing down your question…")
        } else if model.voiceState == .requestingPermission {
            compactNotice("Allow Microphone access to ask a spoken question.")
        }
    }

    private func compactNotice(_ message: String) -> some View {
        Text(message)
            .font(.system(size: 12))
            .foregroundStyle(TrulyTheme.text)
            .lineLimit(2)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
