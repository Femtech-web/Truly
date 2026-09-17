# Privacy direction

Truly captures only when the learner explicitly clicks its companion. The screenshot stays in Mac memory until the learner submits a question or closes the workspace. Submitting Ask after processor-specific approval sends that bounded frame, the question and minimum active Task or Path context to the configured AI provider. The current disclosure approval is remembered locally on that Mac until the learner revokes it from the workspace or menu bar; it is not a wallet or macOS capture permission. A changed disclosure revision asks again. Capture, dragging and ordinary clicks do not upload a frame.

Voice begins only while the learner holds the microphone control. The one-time versioned Groq learning disclosure covers both deliberately sent frames and voice recordings; macOS separately asks for microphone access on first use. Truly caps a recording at 30 seconds, keeps it in a temporary local file only long enough to read it, forwards the bounded audio through Core to Groq Whisper for transcription, and deletes the file immediately. Core does not store the audio or transcript as a separate record. The transcript enters the same consented screen-aware question flow. Optional answer playback uses the Mac's built-in speech synthesizer and can be turned off in the menu.

Voice retries never insert a made-up question. Very short recordings are discarded locally; likely silence is screened after transcription, and uncertain words require the learner to review and submit them. Closing the question bar, changing the active Task or turning off AI help cancels pending voice work. An upload already sent cannot be recalled. Spoken playback stops before another recording starts. These safeguards do not enable background microphone listening.

For the competition MVP:

- Screenshots and microphone recordings are not stored by Truly.
- Capture requires clear onboarding and macOS permission approval.
- API credentials remain in server-side Worker secrets.
- Wallet actions occur only inside Nimiq Pay with native user confirmation.
- A paired desktop can be revoked from the Mini App.
- Device management requires a separate signed wallet approval. Its 15-minute session is held in memory, not browser storage.
- A screen frame can leave the Mac only after an explicit Ask action and a remembered approval for the current processor disclosure. Core accepts one bounded JPEG and does not persist it. Revocation is available in the workspace and menu bar.
- The Groq runtime remains disabled unless the deployed environment confirms Zero Data Retention is enabled. Request metadata may still be retained by infrastructure; production disclosure must name the processor and final policy.
- Revocation invalidates desktop authority immediately on Core; the Mac reflects it on its next reachable session check.
- Short-lived, hashed abuse-counter keys support rate limiting. Expired counters are cleaned in bounded batches.
- Logs exclude screenshots, recordings, transcripts, signatures, and session tokens.
- Creator-, learner- and AI-supplied links are treated as untrusted. Truly accepts secure web links (plus loopback HTTP for local development), rejects embedded credentials and unsupported schemes, and never opens a Mac link merely because the phone activates a Task or Path. The Mac shows the destination domain and waits for a local click.

This file records the intended public promise, not a finished legal privacy policy. Provider identities, retention periods, account deletion, and contact details must be finalized before public launch.
