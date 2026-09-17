# Privacy direction

In Text mode, a companion click captures locally and only Ask submits the frame after remembered processor consent. Voice mode separately asks for opt-in to local microphone listening for **Hey Truly**. A completed wake-word question captures one screen at the pointer's wake location and sends the question text plus bounded frame to Groq after processor consent. Uncertain recognition opens for review instead. Dragging, pointer following and ordinary app clicks never capture or upload.

Hands-free recognition is required to run on-device with Apple Speech. Ambient audio and text are neither written to disk nor sent to Core; unsupported recognition never falls back to cloud ambient listening. Only the activated question is retained temporarily. The wake phrase is not speaker authentication: another person or media can trigger it. Bounded local recognition segments are restarted; this is not a dedicated low-power wake engine. Accuracy, energy and background-noise acceptance remain pending.

Listening requires separate local opt-in, an active Task, paired state, processor consent and a visible companion. The menu shows state and Pause/Resume. Listening stops during spoken playback, while editing a question, on Pause/Hide, processor revocation, Task changes, sleep and logout. The input preference is remembered but voice starts paused after app restart. Reset hands-free permission in Settings switches to Text and clears the separate opt-in.

**Record a question** is a deliberately selected cloud-transcription alternative, never an automatic fallback. It captures a current frame and records at most 30 seconds, ending after a pause or the learner's Finish action. The temporary M4A is deleted after reading; Core forwards only the bounded recording to Groq Whisper without saving it. The versioned processor disclosure covers these requested frames and recordings; macOS separately requests Microphone and Speech Recognition access. Optional reply playback uses built-in Mac speech, applies only in Voice mode and can be changed to Text without losing the saved preference.

Voice retries never insert a made-up question. Very short or locally silent explicit recordings are discarded locally; cloud transcription also screens likely silence. Uncertain words require review and Ask. Closing the question bar, changing Tasks or turning off AI help cancels pending voice work. An upload already sent cannot be recalled. Wake recognition stays off during spoken playback and a short cooldown.

For the competition MVP:

- Screenshots and microphone recordings are not stored by Truly.
- Capture requires clear onboarding and macOS permission approval.
- API credentials remain in server-side Worker secrets.
- Wallet actions occur only inside Nimiq Pay with native user confirmation.
- A paired desktop can be revoked from the Mini App.
- Device management requires a separate signed wallet approval. Its 15-minute session is held in memory, not browser storage.
- A frame can leave the Mac only after Ask or a completed explicitly enabled wake-word question, with remembered processor approval. Core accepts one bounded JPEG and does not persist it. Revoke AI help in Settings → Privacy.
- The Groq runtime remains disabled unless the deployed environment confirms Zero Data Retention is enabled. Request metadata may still be retained by infrastructure; production disclosure must name the processor and final policy.
- Revocation invalidates desktop authority immediately on Core; the Mac reflects it on its next reachable session check.
- Short-lived, hashed abuse-counter keys support rate limiting. Expired counters are cleaned in bounded batches.
- Logs exclude screenshots, recordings, transcripts, signatures, and session tokens.
- Creator-, learner- and AI-supplied links are treated as untrusted. Truly accepts secure web links (plus loopback HTTP for local development), rejects embedded credentials and unsupported schemes, and never opens a Mac link merely because the phone activates a Task or Path. The Mac shows the destination domain and waits for a local click.

This file records the intended public promise, not a finished legal privacy policy. Provider identities, retention periods, account deletion, and contact details must be finalized before public launch.
