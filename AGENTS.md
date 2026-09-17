# Truly agent instructions

## Mission

Build Truly's competition tracer bullet: pair a Nimiq wallet with the macOS companion, create a Task or choose a creator Path, complete one contextual learning challenge, and see durable progress in the Mini App.

## Current phase

Phase 0, private preparation, and website foundation are established. The user has accepted a real Nimiq Pay account request and completed one real signed Mac pairing; rejection, restart persistence and wallet-owned revocation remain pending Phase 4 recovery gates. Device-management state survives Mini App tab changes, and the connected-address control opens Truly's narrow Wallet & access surface while general fund management remains in Nimiq Pay. Phase 5A Core accepts authenticated, consented, bounded Groq vision turns with quotas/concurrency and no progress authority. Phase 5B implements the wallet-to-Mac Path handoff. Phase 5C has a locally verified direct-Task and voice foundation. Phase 5D adds durable My Tasks/Explore Paths information architecture, Task/Path workspace links and resources, explicit Mac link approval, a separate Task panel and compact status-only menu. Real Nimiq Pay-to-Xcode Task/Path/link/voice acceptance remains pending. Rubric progress, NIM/USDT settlement and Creator Studio publishing remain unimplemented. Local checks are not a production-ready journey.

## Source-of-truth pointers

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
