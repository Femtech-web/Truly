# Privacy and security model

Truly is designed around deliberate capture, wallet-owned authority and minimal learning records. This document describes the product’s technical privacy behavior; it is not a substitute for the public legal privacy notice supplied with a hosted release.

## Screen capture

- Dragging the companion, moving the pointer and ordinary application clicks do not upload the screen.
- A typed Ask, completed opted-in voice question or **Check my work** captures one fresh bounded frame.
- The learner approves the current AI processor disclosure before a frame can leave the Mac.
- ScreenCaptureKit excludes Truly’s own windows.
- Truly does not persist screenshots or create a background screen history.
- Offline practice never queues a hidden frame; the learner reconnects and captures again deliberately.

## Microphone and speech

Text and Voice are separate preferences. Voice requires macOS Microphone and Speech Recognition permission plus a local Truly opt-in.

Hands-free recognition runs with Apple Speech on-device. Ambient audio and recognition text are not sent to Core. A completed confident question sends only the recognized question and one current frame through the same consented teaching endpoint. Uncertain recognition opens for review instead of inventing a question.

Listening stops during spoken playback, editing, Pause, Hide, Task changes, sleep, logout and privacy revocation. Voice begins paused after an app restart.

**Record a question** is a deliberate cloud-transcription action, not an ambient fallback. It records bounded temporary audio, deletes the Mac file after reading it and is not persisted by Core. Optional spoken answers use the built-in macOS synthesizer.

## AI processing

- Provider requests pass through Truly Core; API credentials never enter either client.
- The runtime requires the configured provider’s Zero Data Retention setting.
- Requests are authenticated, size-bounded, rate-limited and tied to an active Task and Mac.
- Truly stores no frame, voice recording or raw model reasoning.
- Minimal assessment receipts contain criterion statuses, request integrity data and resulting progress.
- AI-checked progress is feedback, not certification.

## Wallet and payments

Nimiq Pay owns wallet creation, import, keys, recovery words, account exposure and native transaction confirmation. Truly never asks for a private key or recovery phrase.

A pasted public address is not treated as identity. Truly lists only accounts Nimiq Pay shares and verifies purpose-bound signatures when authority matters. Switching accounts revokes the current browser sign-in and clears private UI state before loading the selected owner.

Pairing, creator access, review and purchase preparation use scoped signatures that cannot send funds. A paid Path still requires a separate native Nimiq Pay transaction confirmation showing the amount and recipient. Core independently verifies the finalized transfer before writing access.

Nimiq Pay remains the source of truth for complete balance and wallet history. Truly displays only its validated Path payments and entitlements.

## Identity and sessions

- Browser access uses a fixed-duration server grant resumed through a host-only HttpOnly, SameSite=Strict cookie.
- Production cookies use `Secure` transport over HTTPS.
- Private requests are owner-scoped and compare the expected account with the verified session.
- Browser tokens are not stored in localStorage or sessionStorage.
- Disconnect revokes the browser grant; it does not delete Tasks, revoke paired Macs or move funds.
- The Mac stores its device credential in Keychain and validates it with Core.
- Revoking a Mac invalidates its device authority and desktop sessions.

## Tasks, Paths and creators

Private Task content is available only to its wallet owner and an authenticated paired Mac while that Task is active.

Creator profiles and published Path libraries are public. Drafts stay private to the creator; an exact submitted revision becomes available to authorized reviewers. Review records include the public reviewer wallet, decision and notes.

Creating a personal Task sends its goal and optional resource names or domains to the planner. Truly does not fetch linked page content or represent that the model read it. The learner can review and edit the draft before starting.

## Links

Creator-, learner- and AI-supplied links are untrusted input. Truly accepts secure web links plus loopback HTTP for local development, rejects embedded credentials and unsupported schemes, and never opens a destination merely because a Task was activated from the phone. The Mac displays the destination domain and waits for a local click.

## Logs and retention

Application logs exclude screenshots, recordings, transcripts, signatures, session tokens and recovery material. Expired rate-limit records are removed in bounded cleanup. Durable product state is limited to account identifiers, devices, Tasks, immutable Path versions, access proofs, progress receipts and creator review history required to provide the service.

See [AI.md](AI.md) for model-specific safeguards and [ARCHITECTURE.md](ARCHITECTURE.md) for authority and storage boundaries.
