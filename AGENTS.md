# Truly agent instructions

2026-09-17 creator-profile acceptance: learner `NQ47…2AG1` successfully approved Creator Studio and its active creator profile exists. A read-only local D1 check confirmed `Defi preacher` / `This is me` were saved at the screenshot time; the apparent failure was off-screen global feedback, not a failed mutation. Profile success/error feedback now belongs beside **Save changes**, and the card visibly labels the profile Active. Native Path draft/submit/review remains pending.

2026-09-17 wallet-selection recovery: real Nimiq Pay discovery exposed two existing user accounts; these are provider results, never hard-coded Truly wallets. Truly must not accept a pasted address as authenticated identity or create/import wallets. First account selection does not require a Core logout; an actual cross-wallet switch remains fail-closed on logout to prevent mixed sessions. The current Mac LAN IP changed from `.3` to `.2`, so ignored Mini App/Core URL and CORS configuration was updated; physical reconnection after user-owned server restarts remains pending.

## Mission

2026-09-17 latest physical acceptance (supersedes older Test P-pending notes below): the user reports the purchased **NIM payments users can trust** Path passed **Set a clear price** using the agent-assisted practice page, synced **1 of 3** progress to the phone, retained it after restarting Truly/reloading the phone, and advanced to **Show a simple payment review**. Do not ask the user to repeat this positive assessment/sync/restart slice. Real microphone input and Truly replies also work (user-reported; precise voice/noise conditions unspecified). Full 3/3 completion, independent own-work/negative assessment accuracy, speech false-wake/self-trigger/recovery, and native Creator Studio/review/account switching remain pending. The practice fixture proves real progress plumbing, not independent learner mastery.

2026-09-17 authoring policy override: the user explicitly authorized open, purpose-signed creator profiles/private Free/NIM drafts, Create Path on Explore Paths, SDK-exposed account choice/switch and a wallet-authenticated manual review queue. Publishing still requires approval. Learner `NQ47…2AG1` is the authorized LOCAL reviewer via ignored `REVIEWER_WALLETS`; never hardcode a production admin, grant review to all creators, or auto-publish. Migration 0014 adds the public reviewer audit address. Other creators' paid drafts do not broaden the existing controlled payment recipient. Native multi-account signing/Test CS and physical Test P remain manual gates.

2026-09-17 sequencing exception: the user deferred physical Test P (own work → Check my work → phone completion → restart both clients) and requested Creator Studio/reliability now. Keep that release gate pending; local tests never imply native/model-quality acceptance. Studio beta operations: `docs/CREATOR-STUDIO.md`; acceptance: Test CS/reliability in the living playbook. Seller `NQ12…PB5G` already owns the active local creator. Review is separate operator authority; never approve unexercised content or enable USDT without authorization.

Build Truly's competition tracer bullet: pair a Nimiq wallet with the macOS companion, create a Task or choose a creator Path, complete one contextual learning challenge, and see durable progress in the Mini App.

## Current phase

Phase 0, private preparation, and website foundation are established. The user confirmed the latest phone/Mac flow, including restart and revocation, works and authorized finishing Phase 5. Phase 5A teaching remains progress-free. Phases 5B–5D provide Tasks/Paths, signed handoff, resources, compact panels and consented text/voice. Phase 5E implements explicit AI practice assessment, conservative rubric validation, atomic/idempotent progress receipts, completion and owner-scoped synchronization. Migration 0011 is applied locally; practice inference-quality and physical completion/restart acceptance remain pending. At the user's explicit request, guarded Phase 6 implementation began before that physical gate. A live 0.01 NIM TestAlbatross purchase for `skill_nim_payments` to seller `NQ12 37R4 KTF9 AC69 S6SM VMA5 K0TA KYPC PB5G` has now passed native approval, independent finalized settlement validation and exactly-once durable entitlement. The successful Nimiq Pay transaction used contract-held wallet funds, so a connected basic-address RPC balance is not the complete Nimiq Pay portfolio and must not be presented as such. Committed/production payment defaults and all USDT paths remain disabled. The paid-Path handoff regression, physical Test P, Creator Studio, deployment and launch hardening remain. AI-checked screen evidence is fallible and is not certification or blockchain verification. Local checks are not a production-ready journey.

## Source-of-truth pointers

Mini App resumption: previously signed fixed 15-minute authority can resume through a host-only HttpOnly/SameSite=Strict cookie (Secure on HTTPS production), never localStorage credentials. Cookie operations require an allowlisted Origin/custom CSRF header and expected-account binding. Restore no native approval in the background; polling never extends expiry. Only UI page/tab preferences use sessionStorage. Same-site app/API or a same-origin proxy is a deployment requirement. Tasks auto-load after valid resume; expiry needs a deliberate renewed signature. Personal plan generation uses 1–8 goal-appropriate steps and resource names/domains only, not page fetching. Editing requires tasks:edit, direct/draft state, matching revision and no session history. iPhone cookie retention and actual plan quality remain Test R, not inferred from unit tests.

Desktop input refinement: Text/Voice selection, separate Voice-only reply preference, gated on-device Hey Truly/question recognition, cursor-offset following, pause/consent/reset and explicit cloud Record a question are implemented. Voice starts paused across restart and suspends during editing/playback/sleep/logout. Explain/Guide are progress-free; only explicit Task-panel Check my work can submit a fresh practice frame. Persist only sanitized criterion outcomes and receipts, never screenshots, notes or model evidence. Offline work requires a new deliberate capture, not a screenshot queue. Static/unit checks are not native microphone/wake/energy acceptance.

- **Product or scope work:** read `private-notes/docs/00-product-brief.md` and `private-notes/docs/01-mvp-scope.md` when the ignored private notes are available.
- **Architecture changes:** read `private-notes/docs/03-system-architecture.md` and update public `docs/ARCHITECTURE.md` when the accepted boundary changes.
- **Implementation sequencing:** follow `private-notes/docs/04-implementation-plan.md`; pass each phase gate before advancing.
- **Nimiq wallet work:** read `private-notes/docs/05-nimiq-integration.md` and `private-notes/docs/13-mini-app-development-runbook.md`.
- **Any testable behavior change:** update `private-notes/docs/16-living-test-playbook.md` with prerequisites, steps, expected result, and current status. This is the human-readable testing source of truth.
- **UI or brand work:** read `private-notes/docs/06-brand-and-ui-system.md`.
- **Screen, audio, wallet, identity, or analytics work:** read `private-notes/docs/07-privacy-and-security.md` and public `docs/PRIVACY.md`.
- **Desktop reference work:** read the ignored private reference notes before adapting any external implementation.

## Repository boundaries

Creator and commercial work follows `private-notes/docs/18-creators-and-skill-publishing.md` and `private-notes/docs/17-retention-and-revenue.md`: any subject, multiple tags, creator profiles, and NIM plus USDT, with server-side entitlement authority.

- `apps/desktop`: macOS learning interaction.
- `apps/miniapp`: mobile-first Nimiq Pay Mini App.
- `apps/site`: public landing, download, trust, and deep links; it contains no wallet authority.
- `worker`: secret-bearing upstream proxy and cross-device API.
- `packages/contracts`: shared request and event schemas.
- `packages/design-tokens`: platform-neutral brand values shared by the website and Mini App.
- `packages/skill-schema`: Skill manifests, steps, hints, and rubrics.

## Guardrails

- Close temporary servers and browser sessions started by the agent before handoff. Never stop user-owned processes. Before starting a server, inspect its port; an existing listener is not permission to terminate it. Ask when ownership is uncertain.
- Keep external reference code outside the public repository.
- Run the macOS app through Xcode once the Truly-branded capture-to-pointer loop is ready. Avoid terminal `xcodebuild` because macOS privacy permissions must remain associated with the expected app.
- Keep API keys in ignored local files or deployed Worker secrets. Commit only examples with empty values.
- Access the Nimiq provider exclusively through `@nimiq/mini-app-sdk`'s `init()` helper.
- Put account, signature, transaction, and staking requests behind clear user actions because each opens native approval.
- Treat model output as untrusted. Application code validates pointer coordinates and learning-state transitions.
- Store no screenshots or microphone recordings by default.
- Preserve legally required third-party copyright and license notices if code is later reused; public product copy must describe Truly only.

## Completion discipline

Every change ends with the narrowest relevant verification. Record blocked manual checks explicitly. Update this file when repository boundaries, commands, or durable conventions change; leave feature detail in the referenced documents.
2026-09-17 documentation/draft-deletion acceptance: Creator Studio now allows creators to explicitly delete only private `draft`/`rejected` revisions. Submitted `review` snapshots stay locked; deleting a new draft also removes its abandoned unpublished Path shell, while deleting an update preserves the published Path/version. Core tests cover all three boundaries. The public site now has a product-facing `/docs` guide; root README and `docs/PRODUCT-GUIDE.md` describe the verified testnet product rather than stale phase status. Physical deletion remains to be confirmed in Nimiq Pay after reloading updated Core/Mini App.
