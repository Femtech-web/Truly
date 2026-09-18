# AI teaching and assessment

Truly uses AI for contextual teaching, personal Task planning and visible practice assessment. The model is always behind Truly Core; clients never receive provider credentials or call the provider directly.

## Deliberate input

A screen frame can leave the Mac only when the learner:

- submits a typed question;
- completes an explicitly enabled voice question; or
- chooses **Check my work**.

Capture alone remains local. The request requires an authenticated desktop session, an active Task, a current processor disclosure and a bounded JPEG. Truly does not retain the frame as a screenshot history.

## Teaching

Core resolves the exact Task, immutable Path version and current step before building the model request. The teaching endpoint validates structured output and always reports `progressRecorded: false`.

Explain mode focuses on the visible concept and why it behaves that way. Guide mode returns one useful, evidence-aware next action. Neither mode can operate the Mac, invoke the wallet, grant an entitlement or mark a step complete.

## Practice assessment

**Check my work** is a separate authenticated request against the criteria saved with the current step. The assessor must return one concrete observation for every criterion. Core rejects incomplete coverage, unknown statuses, invalid confidence values and empty evidence.

Progress advances only when every criterion is met at the configured confidence threshold. The application—not the model—owns the database transaction, idempotency and next-step calculation. Stored receipts contain sanitized statuses and request integrity data rather than frames or raw model reasoning.

Assessment is labelled **AI-checked**, not certified. Visible evidence cannot prove hidden behavior, and a documentation page or unsupported claim is not accepted as completed practical work.

## Personal Task planning

The planner receives the learner’s goal and optional resource names or domains. It does not fetch linked pages or claim to have read them. It returns a focused plan with the smallest useful number of steps, preserves conceptual versus practical intent, and attaches visible practice criteria where appropriate.

The learner reviews and can edit a private plan before starting. Once work has begun, its criteria and history are not silently rewritten.

## Voice

Hands-free **Hey Truly** recognition uses Apple Speech on-device. Ambient audio and recognition text are not uploaded. A completed question opens the recognized words with one locally captured frame for review; the screen-aware teaching request begins only after the learner presses **Ask**.

**Record a question** is a separate user action that sends bounded temporary audio through Core for transcription. The Mac deletes its local recording after reading it, and Core does not persist the upload. Spoken replies use the built-in macOS synthesizer, with wake listening suspended during playback.

## Provider boundary

The deployed runtime requires the configured provider’s Zero Data Retention setting. Core applies authenticated size, rate and concurrency limits and refuses malformed provider output. Provider identity and processing are disclosed before the first request and whenever that disclosure changes.

Related documentation:

- [Privacy](PRIVACY.md)
- [Architecture](ARCHITECTURE.md)
