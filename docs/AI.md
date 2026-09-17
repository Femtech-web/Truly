# AI runtime direction

Desktop Ask is connected to Core's guarded learning boundary, but live-model quality acceptance is pending. Capturing by itself remains local; only the explicit Ask action sends the current frame after the learner approves the current Groq disclosure. That versioned choice is remembered locally on the Mac until revocation and asks again when the disclosure changes. No canned teaching answer or completion credit is presented as AI output.

The first runtime will evaluate a free-tier Groq vision model through Truly Core. [Groq documents image/text input and JSON mode](https://console.groq.com/docs/vision). Quality, model access and quotas must pass screenshot-grounding and rubric tests before release.

Only deliberate question submission may upload one bounded JPEG after processor-specific consent. Keys stay on Core. Truly does not store frames; provider retention is a separate disclosure. The runtime refuses inference unless the deployed environment confirms [Groq Zero Data Retention](https://console.groq.com/docs/your-data) is enabled.

Core authenticates the desktop, resolves the active wallet/device session to either a private Task or immutable Path, limits size/rate/concurrency, then validates structured model output and coordinates. AI cannot invoke wallets, grant entitlements or directly award completion. The current endpoint always reports that progress was not recorded. Free-tier exhaustion must produce clear recovery, never silent paid fallback.

Push-to-talk uses Groq's `whisper-large-v3-turbo` transcription endpoint through Core. Audio is bounded, temporary and not persisted; the transcript enters the existing screen-aware learning turn. Reply speech uses the built-in macOS synthesizer, so Truly does not require a cloud TTS call for the first release. [Groq speech-to-text](https://console.groq.com/docs/speech-to-text), [Groq text-to-speech](https://console.groq.com/docs/text-to-speech), [Groq rate limits](https://console.groq.com/docs/rate-limits).
