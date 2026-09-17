# Truly Desktop

Native macOS menu-bar learning companion. The current foundation starts with a small draggable teal pointer and a six-second greeting, not a large window.

Drag to position it beside your work. Click without dragging to capture that display before the workspace opens. Normal clicks in other apps do nothing. Truly's own windows are excluded. Closing the workspace clears the local image and question.

Pairing, companion visibility and privacy settings live in the menu-bar panel. Keychain sessions are validated at startup and every 15 seconds; Core revocation invalidates authority immediately, independently of that UI check.

Choose a free executable Skill in the Nimiq Pay Mini App, press **Start on my Mac**, and select this paired Mac. Core creates or resumes the authoritative session. The desktop discovers it with the Keychain credential, announces the exact Skill and step, and uses that context for Ask; it does not guess from the screenshot. Groq approval is explicit once for the current disclosure revision, remembered locally and revocable from the workspace or menu bar. Capture alone remains local.

## Run in Xcode

1. Open `Truly.xcodeproj`, select **Truly → My Mac**, then press Command–R.
2. If signing needs setup: click the top blue project item, choose **TARGETS → Truly → Signing & Capabilities → Team**. The existing team configuration is preserved.
3. Expect the teal companion near the right side of your main display and the Truly menu-bar icon.
4. Click the companion. Allow Screen Recording when requested; enable Truly in macOS Privacy & Security and restart through Xcode if required.
5. Close the workspace, bring your learning context forward, then click the companion again.
6. Use the menu-bar icon to pair this Mac or hide/show the companion.

## Verification boundary

Swift typechecking and project/plist parsing pass; actual Xcode startup, click capture, Spaces/multi-display behavior and Keychain recovery still need manual acceptance. Avoid terminal `xcodebuild` so privacy identity stays associated with the intended app.

The guarded Groq vision path is connected, but live quality acceptance, rubric evaluation and durable progress remain incomplete. Model responses cannot award progress. Voice is not connected. The companion is draggable, not continuously system-cursor-following. Runtime details are described in [AI direction](../../docs/AI.md).
