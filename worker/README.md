# Truly Core

Cloudflare Worker/D1 API for signed Mac pairing, desktop sessions, wallet-authorized device control and learning activation, persisted rate limits, a dynamic creator-aware catalog and the guarded vision-turn boundary. Rubric evaluation, progress, payments and Creator Studio publishing are not implemented yet.

Secrets belong in deployed Worker secrets or an ignored `.dev.vars`. Copy `.dev.vars.example` locally and fill it without committing values.

Local setup:

```bash
npm install --legacy-peer-deps
npm run db:migrate:local
npm run dev
```

Configure the exact Mini App origin in `ALLOWED_ORIGINS` and `PAIRING_ORIGIN`; the phone needs the Mac's LAN URL, not localhost. Stop the server with Control–C when testing finishes.

Checks: `npm test`, `npm run build` (dry-run only), and `npm run test:api` while the local server runs. The API smoke check leaves generated test records only in the ignored local database and prints no tokens or keys.

The Worker uses pure-JavaScript Ed25519/Blake2b primitives and Nimiq's signed-message convention. The official Nimiq Core is a development test oracle only: its full WASM bundle cannot start in this Worker runtime. Local tests are not actual Nimiq Pay acceptance evidence.

Wallet control: create `/v1/auth/challenges`, sign its exact purpose-bound statement, verify at `/v1/auth/challenges/:id/verify`, then use the memory-only 15-minute scoped token for device listing/revocation and learning-session activation. `POST /v1/learning/sessions/activate` is idempotent, verifies device ownership, immutable Skill version and entitlement, and makes that session visible only to the selected desktop at `GET /v1/desktop/learning-session`. Desktop tokens cannot manage wallet devices or activate Skills. No private keys or real funds are used by tests.

Rate limits use atomic D1 one-minute windows. Repeated guesses return 429 with `Retry-After: 60`; wait 60 seconds between smoke-suite runs because stress counters survive restarts. Missing trusted edge IP uses a shared local-development bucket. JSON bodies are capped at 16 KiB. Future AI uploads need a separate bounded contract.

Learning turns use `POST /v1/learning/turn` with an active desktop bearer session. Core accepts one base64 JPEG no larger than 1 MiB, a real published Skill/version/step, the current explicit Groq processor-consent revision and an owned/free entitlement. It refuses to run unless server-side Zero Data Retention confirmation is enabled. Per-device minute limits, a project daily cap and D1 concurrency leases bound free-tier usage. Model output is parsed into a narrow response and cannot record completion or progress. Desktop Ask calls this endpoint only after the current processor disclosure has been approved on that Mac; capture alone never uploads it.

Before public deployment: replace the D1 ID placeholder, configure HTTPS origins and edge abuse protection, set Groq secrets and `GROQ_DATA_CONTROLS_CONFIRMED=true` only after verifying the production organization, complete Nimiq Pay/Xcode recovery acceptance and finalize creator identities/payouts. Seed prices are disabled and curricula are previews.
