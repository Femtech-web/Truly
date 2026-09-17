# Architecture

Truly separates authority by surface:

```text
Website ───────────── product story, download, trust, Mini App deep link

macOS Desktop ─────── screen/audio capture, AI teaching, pointer, Task runtime
       │
       ├───────────── Truly Core: pairing, sessions, entitlements, progress
       │                                  │
Nimiq Pay Mini App ─ wallet identity, signature, NIM purchase, device control
```

## Boundaries

- The desktop observes only after deliberate invocation and never performs wallet operations.
- The Mini App requests wallet operations through providers injected by Nimiq Pay; keys remain in the wallet.
- The Core API owns durable cross-device state and external AI/speech secrets.
- The website owns acquisition and distribution. It may link into Nimiq Pay but cannot impersonate its confirmations or grant entitlements.

## Planned technology

- Desktop: Swift and SwiftUI with AppKit where macOS overlay behavior requires it.
- Mini App: React, TypeScript, and Vite with `@nimiq/mini-app-sdk`.
- Website: React, TypeScript, and Vite, sharing brand tokens rather than wallet runtime code.
- Core: Cloudflare Workers with D1 for the initial relational state.

The Website and Mini App may share platform-neutral design tokens. They do not share wallet initialization or page-level UI because their hosts, audiences, and performance constraints differ.

The desktop starts as a menu-bar utility with a small draggable teal companion and a user-dismissible notice. AppKit owns an explicit `NSStatusItem` and transient `NSPopover`, so the settings surface is closed on launch and always opens from the menu-bar icon instead of being restored as a free-floating window. `CompanionPanelController` owns the non-activating panel; `DesktopAppController` owns presentation; the learning model owns deliberate capture. A companion click captures the display at the click location before opening a compact Task-or-Path/mode/question bar. The active step is available as secondary context in the tooltip and menu rather than being mistaken for connection status. The screenshot remains in memory and is not reproduced in the interface. Dragging and ordinary app clicks do not capture. ScreenCaptureKit excludes Truly's own windows. A validated answer closes the bar and appears in a complete, user-dismissible pointer card beside its target or the current cursor. Closing the workspace clears its frame and question.

Phase 5A connects the deliberate desktop Ask action to Core's guarded Groq vision endpoint. The learner approves the current Groq disclosure once on that Mac; the versioned choice is remembered locally until revocation from the workspace or menu bar. Capture alone remains local and only Ask uploads the current bounded frame. Fixed teaching answers, synthetic completion and placeholder targets remain removed. Rubric evaluation and progress are not connected. See [AI direction](AI.md).

The accepted production handoff begins either with a learner-authored Task or on Path detail in the Mini App. **Start on my Mac** lets the learner select an active paired Mac and sends a narrowly scoped, wallet-authorized activation command to Core. Starting a Path creates or resumes a Task backed by that immutable Path version; a direct Task has learner-owned goal context instead. Core—not either client—binds the wallet, selected device, Task, current step and any Path entitlement. The desktop polls for the selected session with its Keychain credential, announces the exact Task and step only when Core reports a new explicit activation/update, and uses them for every learning turn. Restoring an unfinished session at app startup updates learning context silently so the generic startup greeting is not replaced. The desktop never guesses learning context from a screenshot or keeps a production hardcoded Path.

The Mini App's Learn surface keeps these concepts visibly separate: **My Tasks** contains wallet-owned private work and **Explore Paths** contains creator-published products. New Task creation uses a focused bottom sheet with one required goal and optional reviewed links; Home stays an entry and resume surface rather than duplicating the learner's library.

Creator Paths and learner Tasks have separate persistence and provenance but return one session envelope to the Mac. A direct Task is private, free and wallet-owned; Core generates its short plan, the learner reviews it before activation, and no creator, price or entitlement is invented. Starting a Path creates or reuses a wallet-owned Task pinned to its immutable Path version; My Tasks includes it with its creator provenance. The original Path-session tables remain readable only for development compatibility. Learning turns identify the authenticated session instead of trusting client-supplied Path identity, so Core resolves the exact Task or immutable Path context bound to the Mac.

Task and Path steps may carry one primary workspace link plus supporting resources. Links are untrusted content: Core accepts HTTPS and loopback HTTP for local development, rejects embedded credentials and remote plain HTTP, and bounds the resource count. Activating a session never opens a URL. The Mac first shows **Open _domain_** in a persistent notice or Task panel; only that explicit local action calls `NSWorkspace`. Supporting resources remain in a separate Task panel.

Voice is an optional input to the same desktop learning turn. The learner holds the microphone to record, with a 30-second safety cap. The Mac deletes its temporary M4A immediately after reading it, Core forwards bounded multipart audio to Groq Whisper without persistence, and the transcript becomes the normal question paired with the deliberately shared frame. Optional reply playback uses macOS system speech rather than another cloud speech service.

The menu-bar popover is intentionally a compact status surface: connection, current Task/Path, companion visibility, Ask, spoken replies, Settings and Quit. Task details/resources and connection/privacy controls live in separate native panels. The current API and persistence layer still use `skill` identifiers while this terminology migration is staged. Those names are implementation compatibility details; learner-facing product language follows [the domain glossary](../CONTEXT.md).

The workspace and menu popover use an explicit light appearance so neutral text remains readable under dark macOS settings. Capture excludes Truly windows by owning process as well as bundle identity. Offline pairing shows the configured Core endpoint and, for loopback development only, a Worker-start instruction. A stored desktop session can retry validation without generating another pairing code; validation still determines authority. A local Core process must remain running during development tests—it is not embedded in the Mac app. Phone host loading is a separate acceptance dependency.

The Mini App isolates `@nimiq/mini-app-sdk` behind a wallet port and requests accounts/signatures after learner actions. Product screens consume normalized wallet state. Ordinary browser preview is read-only; no demo wallet can create identity or signed pairing.

The connected-address control opens a narrow **Wallet & access** surface for Truly identity, paired Macs and future verified Skill receipts. It does not copy Nimiq Pay's balance, top-up, withdrawal, recovery, network or general-transfer controls. Disconnecting clears the Mini App's local wallet session; it does not revoke a paired Mac or move funds.

Core implements Worker/D1 pairing, hashed five-minute codes/exchange secrets, Nimiq signed-message verification, one-use claims and hashed desktop sessions. The Mac stores credentials in Keychain and validates at startup and every 15 seconds; a 401 clears credentials and the local learning context. Every future authenticated operation must check authority independently of this UI heartbeat.

Device and learning control use one five-minute, purpose-bound wallet signing challenge and a 15-minute opaque wallet session kept only in Mini App memory. Its explicit scopes cover listing/revoking devices, reading Tasks and learning sessions, creating Tasks and activating the selected Task/Path; it cannot move funds. `GET /v1/devices`, `GET /v1/tasks` and `GET /v1/learning/sessions` are owner-scoped. `POST /v1/tasks` creates a wallet-owned Task; activation routes check ownership and device status, while Path activation also checks published immutable version and free/owned entitlement. `GET /v1/desktop/learning-session` exposes only the session assigned to the authenticated Mac. `POST /v1/devices/:id/revoke` atomically revokes the device, all desktop sessions and outstanding approved pairing exchanges. A desktop token cannot manage wallet devices. Explicit signed re-pairing restores the same device identity and invalidates previous tokens. Cancellation requires the desktop exchange secret.

Phase 5A exposes `POST /v1/learning/turn` only to active desktop sessions. Core checks the published Skill version, step and free/owned entitlement before forwarding one explicitly consented, bounded JPEG to Groq. The runtime requires a server-side Zero Data Retention confirmation, applies per-device/daily quotas and D1 concurrency leases, validates structured output and always returns `progressRecorded: false`. Desktop Ask requires the remembered processor-disclosure revision, compresses the current frame below the limit and maps a validated normalized target back to the original display. The learner can revoke locally at any time; a later disclosure revision asks again. Model output cannot unlock a Skill, operate a wallet or award completion. Live-model quality acceptance, rubric evaluation and durable progress remain subsequent Phase 5 work.

Atomic D1 fixed-window counters bound requests by trusted edge IP, pairing code, installation and signature/exchange target. JSON bodies are streamed with a 16 KiB bound. Counters survive process restarts; expired buckets are cleaned in bounded batches. These controls are not a substitute for production edge abuse protection. Real Nimiq Pay signing, Xcode runtime/Keychain recovery and deployment remain manual gates.

The catalog loads from Core with creator/version/multi-tag metadata, outcomes, prerequisites, supported environments, estimated time and versioned steps. The first free Nimiq curriculum can be activated on a paired Mac; paid NIM/USDT prices remain visible but checkout is disabled until settlement verification exists. AI evaluation, progress, asset settlement and Creator Studio writes/publishing remain separate future phases. See [product vision](PRODUCT-VISION.md).
