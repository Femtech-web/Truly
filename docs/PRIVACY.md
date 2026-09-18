# Privacy direction

In Text mode, a companion click captures locally and only Ask submits the frame after remembered processor consent. Voice mode separately asks for opt-in to local microphone listening for **Hey Truly**. A completed wake-word question captures one screen at the pointer's wake location and sends the question text plus bounded frame to Groq after processor consent. Uncertain recognition opens for review instead. Dragging, pointer following and ordinary app clicks never capture or upload.

Hands-free recognition is required to run on-device with Apple Speech. Ambient audio and text are neither written to disk nor sent to Core; unsupported recognition never falls back to cloud ambient listening. Only the activated question is retained temporarily. The wake phrase is not speaker authentication: another person or media can trigger it. Bounded local recognition segments are restarted; this is not a dedicated low-power wake engine. Accuracy, energy and background-noise acceptance remain pending.

Listening requires separate local opt-in, an active Task, paired state, processor consent and a visible companion. The menu shows state and Pause/Resume. Listening stops during spoken playback, while editing a question, on Pause/Hide, processor revocation, Task changes, sleep and logout. The input preference is remembered but voice starts paused after app restart. Reset hands-free permission in Settings switches to Text and clears the separate opt-in.

**Record a question** is a deliberately selected cloud-transcription alternative, never an automatic fallback. It captures a current frame and records at most 30 seconds, ending after a pause or the learner's Finish action. The temporary M4A is deleted after reading; Core forwards only the bounded recording to Groq Whisper without saving it. The versioned processor disclosure covers these requested frames and recordings; macOS separately requests Microphone and Speech Recognition access. Optional reply playback uses built-in Mac speech, applies only in Voice mode and can be changed to Text without losing the saved preference.

Voice retries never insert a made-up question. Very short or locally silent explicit recordings are discarded locally; cloud transcription also screens likely silence. Uncertain words require review and Ask. Closing the question bar, changing Tasks or turning off AI help cancels pending voice work. An upload already sent cannot be recalled. Wake recognition stays off during spoken playback and a short cooldown.

For the competition MVP:

- **Check my work** in the Task panel is a separate deliberate upload: it captures one fresh screen for Groq to assess the current practice criteria. Truly saves only minimal criterion statuses, a request hash, receipt and resulting progress—not the frame, learner note or raw model observations. AI-checked results are fallible and not certifications.
- Offline practice does not queue or persist screenshots. Reconnect, refresh the Task and explicitly capture again. Cancelling an already-submitted check cannot undo a server-side result that has committed.

- Screenshots and microphone recordings are not stored by Truly.
- Capture requires clear onboarding and macOS permission approval.
- API credentials remain in server-side Worker secrets.
- Wallet actions occur only inside Nimiq Pay with native user confirmation.
- Purchase access signatures cannot send funds. Every NIM or USDT payment requires a separate native wallet confirmation after Truly shows the Path version, exact amount, network, seller and recipient. Core stores an immutable order, public transaction hash and settlement proof; it never stores wallet keys. A submitted hash is not access: Core independently validates the finalized transfer and grants one entitlement. Polygon USDT is mainnet value and remains disabled until a controlled amount and recipient are explicitly configured.
- A paired desktop can be revoked from the Mini App.
- Device and learning access require a separate signed wallet approval. Its fixed 15-minute sign-in can resume through a host-only HttpOnly, SameSite=Strict cookie; production uses Secure cookies over HTTPS. Truly never stores the access token in localStorage/sessionStorage, never extends approval while polling, and requests renewed approval after expiry. Disconnect revokes this sign-in on Core and clears the cookie; paired Macs and saved Tasks remain untouched. LAN HTTP is development-only and does not provide encrypted transport.
- Only non-sensitive entered/page/tab preferences are stored in sessionStorage. Private Task data is fetched with current owner-scoped authority, not loaded from a browser data cache.
- Connecting/switching shows only public accounts Nimiq Pay shares. Switching revokes the current browser sign-in before replacing the selected wallet and clears private UI data; it does not delete saved work or revoke paired Macs. Truly does not create/import wallets or ask for recovery words.
- Approving Creator Studio creates a public wallet-linked profile; its name, bio, optional avatar link and published library are public. Draft content stays private to its creator and authorized reviewers after submission. A separate server-authorized reviewer sign-in can read submitted snapshots and publish/reject an exact revision with notes. Review receipts store the public reviewer address and decision. Neither approval can send funds or read another learner's private Tasks.
- Creating a personal Task sends its goal and optional resource names/domains to Groq to suggest a focused plan. Linked pages are not fetched or represented as read. Review/edit the draft before starting; started Task criteria and published Path versions cannot be edited through this surface.
- A frame can leave the Mac only after Ask or a completed explicitly enabled wake-word question, with remembered processor approval. Core accepts one bounded JPEG and does not persist it. Revoke AI help in Settings → Privacy.
- The Groq runtime remains disabled unless the deployed environment confirms Zero Data Retention is enabled. Request metadata may still be retained by infrastructure; production disclosure must name the processor and final policy.
- Revocation invalidates desktop authority immediately on Core; the Mac reflects it on its next reachable session check.
- Short-lived, hashed abuse-counter keys support rate limiting. Expired counters are cleaned in bounded batches.
- Logs exclude screenshots, recordings, transcripts, signatures, and session tokens.
- Creator-, learner- and AI-supplied links are treated as untrusted. Truly accepts secure web links (plus loopback HTTP for local development), rejects embedded credentials and unsupported schemes, and never opens a Mac link merely because the phone activates a Task or Path. The Mac shows the destination domain and waits for a local click.

This file records the intended public promise, not a finished legal privacy policy. Provider identities, retention periods, account deletion, and contact details must be finalized before public launch.
