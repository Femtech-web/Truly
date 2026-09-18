# Truly Core

Cloudflare Worker/D1 API for signed Mac pairing, desktop sessions, resumable signed Mini App access, learner Tasks, device control/learning activation, rate limits, versioned catalog, guarded teaching/practice/progress, independently verified payments and open wallet-signed Creator Studio. See [Creator Studio](../docs/CREATOR-STUDIO.md) for wallet-admin review/publication and account switching. `REVIEWER_WALLETS` is a server-only comma-separated public-address allowlist; empty means no wallet reviewers. Native authoring/account switching, live model-quality and deferred physical progress gates remain pending; USDT remains disabled.

Secrets belong in deployed Worker secrets or an ignored `.dev.vars`. Copy `.dev.vars.example` locally and fill it without committing values.

Local setup:

```bash
npm install --legacy-peer-deps
npm run db:migrate:local
npm run dev
```

Configure the exact Mini App origin in `ALLOWED_ORIGINS` and `PAIRING_ORIGIN`; the phone needs the Mac's LAN URL, not localhost. Stop the server with Control–C when testing finishes.

Checks: `npm test`, `npm run build` (dry-run only), and `npm run test:api` while the local server runs. The API smoke check leaves generated test records only in the ignored local database and prints no tokens or keys.

Practice: apply migration 0011 before starting Core. `POST /v1/learning/attempts` requires a desktop token, current session/step, bounded consented frame and idempotency key. It validates exact rubric observations, persists sanitized outcomes and advances the Task atomically. Teaching never advances progress. Owner-scoped session reads include completed results; cross-Mac handoff resumes the Task's saved step. Tests use isolated in-memory SQLite with the real migrations and SQL (Node.js 22.13+ with `node:sqlite` required). No external inference or user database is used by that suite.

Payments: apply migration 0012 and keep committed flags false. For an explicitly controlled local acceptance run, configure a separate public seller, trusted HTTPS TestAlbatross RPC and deliberately small NIM price in ignored local state; restart Core after changing `.dev.vars`. Quotes pin the Path/version/asset/recipient/amount. NIM accepts only executed TestAlbatross transfers that are macro-block final; a new hash not yet indexed by the history node remains pending and can be checked again. USDT accepts only a finalized Polygon receipt containing exactly one canonical USDT Transfer from the separately signed EVM sender. Other unavailable RPC checks preserve the submitted reference; mismatches grant nothing. The transaction hash and settlement are globally single-use and a D1 batch creates the validated purchase plus entitlement exactly once. `USDT_MAINNET_APPROVED` is a separate kill switch because Nimiq testnet does not make Polygon USDT a test asset. Never put RPC credentials in committed vars.

The Worker uses pure-JavaScript Ed25519/Blake2b primitives and Nimiq's signed-message convention. The official Nimiq Core is a development test oracle only: its full WASM bundle cannot start in this Worker runtime. Local tests are not actual Nimiq Pay acceptance evidence.

Wallet control: create `/v1/auth/challenges`, sign its exact purpose-bound statement, verify at `/v1/auth/challenges/:id/verify`, then use the fixed 15-minute scoped grant for device listing/revocation, Task creation/editing and learning activation. Mini App requests with `x-truly-browser: 1` receive a host-only HttpOnly/SameSite=Strict cookie; production uses Secure. `GET /v1/auth/session` restores only a valid signed identity without returning its token; `POST /v1/auth/session/logout` revokes that grant and clears the cookie. Cookie-authenticated private routes require `x-truly-account` matching the signed owner. Bearer clients remain supported, without falling back from an invalid explicit bearer. Credentialed CORS requires exact allowlisted origins. Host app/API on the same site (or use a same-origin API proxy) in production; unrelated domains cannot use Strict cookies. LAN HTTP/ports 5173 and 8787 are development-only.

Task plans: `POST /v1/tasks` suggests 1–8 goal-appropriate steps using goal/resource names/domains only, not page fetching. `POST /v1/tasks/:id/plan` requires `tasks:edit`, a personal unstarted draft with no session history and matching `updatedAt`; it cannot modify started work or published Paths. No new migration is required for resumption or draft editing. `POST /v1/learning/sessions/activate` is idempotent, verifies device ownership, immutable Path version and entitlement, and makes that session visible only to the selected desktop. Desktop tokens cannot manage wallet devices or activate work. No private keys or real funds are used by tests.

Rate limits use atomic D1 one-minute windows. Repeated guesses return 429 with `Retry-After: 60`; wait 60 seconds between smoke-suite runs because stress counters survive restarts. Missing trusted edge IP uses a shared local-development bucket. JSON bodies are capped at 16 KiB. Future AI uploads need a separate bounded contract.

Learning turns use `POST /v1/learning/turn` with an active desktop bearer session. Core accepts one base64 JPEG no larger than 1 MiB, a real published Skill/version/step, the current explicit Groq processor-consent revision and an owned/free entitlement. It refuses to run unless server-side Zero Data Retention confirmation is enabled. Per-device minute limits, a project daily cap and D1 concurrency leases bound free-tier usage. Model output is parsed into a narrow response and cannot record completion or progress. Desktop Ask calls this endpoint only after the current processor disclosure has been approved on that Mac; capture alone never uploads it.

Before public deployment: replace the D1 ID placeholder, configure HTTPS origins and edge abuse protection, set Groq secrets and `GROQ_DATA_CONTROLS_CONFIRMED=true` only after verifying the production organization, complete Nimiq Pay/Xcode recovery acceptance and finalize creator identities/payouts. Seed prices are disabled and curricula are previews.
