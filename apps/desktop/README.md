# Truly Desktop

Native macOS menu-bar learning companion. Its menu-bar item uses Truly's monochrome ring-and-dot mark; the full-colour app icon remains in Finder and installation views. It starts with a small teal pointer and a dismissible readiness greeting, not a large window.

Drag to position it beside your work. Click without dragging to capture that display before the workspace opens. Normal clicks in other apps do nothing. Truly's own windows are excluded. Closing the workspace clears the local image and question.

The menu holds quick input/reply and visibility controls. Pairing and privacy live in separate Settings panels. Keychain sessions are validated at startup and every 15 seconds; Core revocation invalidates authority immediately, independently of that UI check.

Move a teaching answer by dragging its **Truly** header, even while words are appearing. The header stays where you place it as the card grows; long answers remain scrollable and selectable. Close the card with its separate close button. Moving a card never captures another screen or changes the active Task.

Text and Voice both use the active Task's title, outcome and current step plus the requested visible frame. Cursor position selects a display and approximate focus, not a new Task. Keep relevant work visible: Truly cannot see hidden tabs, unopened resources or a live view of other pages, and model understanding remains fallible.

Choose a free executable Skill in the Nimiq Pay Mini App, press **Start on my Mac**, and select this paired Mac. Core creates or resumes the authoritative session. The desktop discovers it with the Keychain credential, announces the exact Skill and step, and uses that context for Ask; it does not guess from the screenshot. Groq approval is explicit once for the current disclosure revision, remembered locally and revocable from the workspace or menu bar. Capture alone remains local.

## Run in Xcode

Practice lives in **Open Task → Overview → Check my work**, not the Explain/Guide question bar. The action shares one fresh screen with Groq, applies the saved criteria and displays either a correction/insufficient evidence or saved AI-checked progress. Enable AI help first. New private Tasks and reviewed Paths carry criteria; older Tasks without them remain teaching-only. An AI check is not certification. Refresh after a network error before trying again; no offline screenshot queue is retained.

1. Open `Truly.xcodeproj`, select **Truly → My Mac**, then press Command–R.
2. If signing needs setup: click the top blue project item, choose **TARGETS → Truly → Signing & Capabilities → Team**. The existing team configuration is preserved.
3. Expect the teal companion near the right side of your main display and Truly's ring-and-dot menu-bar mark.
4. Click the companion. Allow Screen Recording when requested; enable Truly in macOS Privacy & Security and restart through Xcode if required.
5. Close the workspace, bring your learning context forward, then click the companion again.
6. Use the menu-bar icon → Settings → Connection to pair this Mac. Start a Task or Path from the Mini App on your phone.
7. To try hands-free input: allow AI help in Settings → Privacy, close the typed bar, select Input → Voice, enable local listening and allow macOS Microphone/Speech Recognition. Say **Hey Truly, explain this page** and pause. Uncertain recognition opens for review. Select Pause to stop listening; Reply chooses Text or Spoken. Local support must be checked on the actual Mac.

Settings → Connection names the active Core environment. The committed desktop build uses **Production Core · app.usetruly.site**. A pairing code exists only in the Core that created it, so a local desktop code cannot be entered into the production Mini App, and a production code cannot be entered into a local Mini App. Stop and rerun Truly through Xcode after changing endpoint configuration; an already running build retains the `Info.plist` compiled into its app bundle.

## Verification boundary

Swift typechecking and project/plist parsing pass; actual Xcode startup, click capture, Spaces/multi-display behavior and Keychain recovery still need manual acceptance. Avoid terminal `xcodebuild` so privacy identity stays associated with the intended app.

The guarded Groq vision path is connected, but live quality acceptance, rubric evaluation and durable progress remain incomplete. Text uses a draggable companion and an Explain/Guide bar without a microphone. Voice uses cursor-offset following and separately opted-in, required-on-device **Hey Truly**/question recognition. It starts paused after restart; the menu offers Resume/Pause and Text/Spoken replies. Unsupported recognition offers Text or deliberate cloud **Record a question**—never cloud ambient listening. Model responses cannot award progress. Microphone/wake/energy/appearance acceptance still requires Xcode on the real Mac. See [AI direction](../../docs/AI.md) and [privacy](../../docs/PRIVACY.md).
