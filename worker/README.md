# Truly Core

Cloudflare Worker/D1 API for signed Mac pairing, desktop sessions, resumable signed Mini App access, learner Tasks, device control/learning activation, rate limits, versioned catalog, guarded teaching/practice/progress, independently verified payments and open wallet-signed Creator Studio. See [Creator Studio](../docs/CREATOR-STUDIO.md) for wallet-admin review/publication and account switching. `REVIEWER_WALLETS` is a server-only comma-separated public-address allowlist; empty means no wallet reviewers. Native authoring/account switching, live model-quality and deferred physical progress gates remain pending; USDT remains disabled.

Secrets belong in deployed Worker secrets or an ignored `.dev.vars`. Copy `.dev.vars.example` locally and fill it without committing values.

Local setup:

```bash
npm install --legacy-peer-deps
npm run db:migrate:local
npm run dev
```

The D1 binding uses the stable local-only preview id `truly-core-local` for `wrangler dev`, keeping local pairings, test purchases and progress separate from the production D1 selected by `database_id`. Local commands stay local unless `--remote` is explicitly supplied.

Configure the exact Mini App origin in `ALLOWED_ORIGINS` and `PAIRING_ORIGIN`; the phone needs the Mac's LAN URL, not localhost. Stop the server with Control–C when testing finishes.

Checks: `npm test`, `npm run build` (dry-run only), and `npm run test:api` while the local server runs. The API smoke check leaves generated test records only in the ignored local database and prints no tokens or keys.

Practice: apply migration 0011 before starting Core. `POST /v1/learning/attempts` requires a desktop token, current session/step, bounded consented frame and idempotency key. It validates exact rubric observations, persists sanitized outcomes and advances the Task atomically. Teaching never advances progress. Owner-scoped session reads include completed results; cross-Mac handoff resumes the Task's saved step. Tests use isolated in-memory SQLite with the real migrations and SQL (Node.js 22.13+ with `node:sqlite` required). No external inference or user database is used by that suite.

Payments: apply migrations through 0018. Production deliberately enables `NIM_PAYMENTS_ENABLED`; `NIM_RPC_URL` is the capability-checked HTTPS MainAlbatross history RPC. There is no global NIM seller setting. A creator’s purpose-signed Nimiq identity is their recipient. Publication snapshots recipient, integer-Luna amount and decimals into the approved version; discovery/order creation require the active price to match it and the creator identity. Quotes copy those exact terms and are explicitly labelled `nimiq-mainnet`. Settlement checks the pinned order, requires MainAlbatross/network ID 24 and rejects Testnet evidence, so later listing edits cannot redirect or reprice a purchase. NIM accepts only executed transfers that are macro-block final; a transfer not yet indexed remains pending and can be checked again. RPC outages preserve submitted references; mismatches grant nothing. Hashes/settlements are single-use and one D1 batch creates settlement, validated purchase and entitlement. Both USDT flags remain false. Never put RPC credentials in committed vars.

Migrations 0015–0016 backfill only matching current-version NIM price snapshots and remove unverified seed snapshots. Migration 0017 preserves historical Testnet orders while allowing new `nimiq-mainnet` orders. Migration 0018 removes stale Testnet wording from the unpurchased Truly-owned seed Path and does nothing after an entitlement exists. Run `npm run db:migrate:local` for the demo database. Back up production D1 and apply `npx wrangler d1 migrations apply truly-core --remote` before deploying this Core version. None of these migrations enables payments.

The Worker uses pure-JavaScript Ed25519/Blake2b primitives and Nimiq's signed-message convention. The official Nimiq Core is a development test oracle only: its full WASM bundle cannot start in this Worker runtime. Local tests are not actual Nimiq Pay acceptance evidence.

Wallet control: create `/v1/auth/challenges`, sign its exact purpose-bound statement, verify at `/v1/auth/challenges/:id/verify`, then use the fixed 15-minute scoped grant for device listing/revocation, Task creation/editing and learning activation. Mini App requests with `x-truly-browser: 1` receive a host-only HttpOnly/SameSite=Strict cookie; production uses Secure. `GET /v1/auth/session` restores only a valid signed identity without returning its token; `POST /v1/auth/session/logout` revokes that grant and clears the cookie. Cookie-authenticated private routes require `x-truly-account` matching the signed owner. Bearer clients remain supported, without falling back from an invalid explicit bearer. Credentialed CORS requires exact allowlisted origins. Host app/API on the same site (or use a same-origin API proxy) in production; unrelated domains cannot use Strict cookies. LAN HTTP/ports 5173 and 8787 are development-only.

Task plans: `POST /v1/tasks` suggests 1–8 goal-appropriate steps using goal/resource names/domains only, not page fetching. `POST /v1/tasks/:id/plan` requires `tasks:edit`, a personal unstarted draft with no session history and matching `updatedAt`; it cannot modify started work or published Paths. No new migration is required for resumption or draft editing. `POST /v1/learning/sessions/activate` is idempotent, verifies device ownership, immutable Path version and entitlement, and makes that session visible only to the selected desktop. Desktop tokens cannot manage wallet devices or activate work. No private keys or real funds are used by tests.

Rate limits use atomic D1 one-minute windows. Repeated guesses return 429 with `Retry-After: 60`; wait 60 seconds between smoke-suite runs because stress counters survive restarts. Missing trusted edge IP uses a shared local-development bucket. JSON bodies are capped at 16 KiB. Future AI uploads need a separate bounded contract.

Learning turns use `POST /v1/learning/turn` with an active desktop bearer session. Core accepts one base64 JPEG no larger than 1 MiB, a real published Skill/version/step, the current explicit Groq processor-consent revision and an owned/free entitlement. It refuses to run unless server-side Zero Data Retention confirmation is enabled. `GROQ_DATA_CONTROLS_CONFIRMED=true` is an operator attestation, not a development convenience: set it only after confirming ZDR in the provider console, and leave it false to fail closed otherwise. Per-device minute limits, a project daily cap and D1 concurrency leases bound free-tier usage. Model output is parsed into a narrow response and cannot record completion or progress. Desktop Ask calls this endpoint only after the current processor disclosure has been approved on that Mac; capture alone never uploads it.

Production serves the Mini App and API from `https://app.usetruly.site`; `https://truly-core.truly-learning-app.workers.dev` remains the Worker fallback URL. The Mainnet RPC and NIM-only global switch are configured. Seed prices stay disabled until an approved Path version contains a creator-signed payout snapshot. Complete the controlled 0.01 NIM acceptance purchase before treating public checkout as accepted; keep both USDT flags false.
