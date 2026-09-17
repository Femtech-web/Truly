# Truly Desktop

Native macOS menu-bar learning companion. It starts with a small teal pointer and a dismissible readiness greeting, not a large window.

Drag to position it beside your work. Click without dragging to capture that display before the workspace opens. Normal clicks in other apps do nothing. Truly's own windows are excluded. Closing the workspace clears the local image and question.

The menu holds quick input/reply and visibility controls. Pairing and privacy live in separate Settings panels. Keychain sessions are validated at startup and every 15 seconds; Core revocation invalidates authority immediately, independently of that UI check.

Choose a free executable Skill in the Nimiq Pay Mini App, press **Start on my Mac**, and select this paired Mac. Core creates or resumes the authoritative session. The desktop discovers it with the Keychain credential, announces the exact Skill and step, and uses that context for Ask; it does not guess from the screenshot. Groq approval is explicit once for the current disclosure revision, remembered locally and revocable from the workspace or menu bar. Capture alone remains local.

## Run in Xcode

1. Open `Truly.xcodeproj`, select **Truly → My Mac**, then press Command–R.
2. If signing needs setup: click the top blue project item, choose **TARGETS → Truly → Signing & Capabilities → Team**. The existing team configuration is preserved.
3. Expect the teal companion near the right side of your main display and the Truly menu-bar icon.
4. Click the companion. Allow Screen Recording when requested; enable Truly in macOS Privacy & Security and restart through Xcode if required.
5. Close the workspace, bring your learning context forward, then click the companion again.
6. Use the menu-bar icon → Settings → Connection to pair this Mac. Start a Task or Path from the Mini App on your phone.
7. To try hands-free input: allow AI help in Settings → Privacy, close the typed bar, select Input → Voice, enable local listening and allow macOS Microphone/Speech Recognition. Say **Hey Truly, explain this page** and pause. Uncertain recognition opens for review. Select Pause to stop listening; Reply chooses Text or Spoken. Local support must be checked on the actual Mac.

## Verification boundary

Swift typechecking and project/plist parsing pass; actual Xcode startup, click capture, Spaces/multi-display behavior and Keychain recovery still need manual acceptance. Avoid terminal `xcodebuild` so privacy identity stays associated with the intended app.

The guarded Groq vision path is connected, but live quality acceptance, rubric evaluation and durable progress remain incomplete. Text uses a draggable companion and an Explain/Guide bar without a microphone. Voice uses cursor-offset following and separately opted-in, required-on-device **Hey Truly**/question recognition. It starts paused after restart; the menu offers Resume/Pause and Text/Spoken replies. Unsupported recognition offers Text or deliberate cloud **Record a question**—never cloud ambient listening. Model responses cannot award progress. Microphone/wake/energy/appearance acceptance still requires Xcode on the real Mac. See [AI direction](../../docs/AI.md) and [privacy](../../docs/PRIVACY.md).
