# Creator Studio beta

Open **Learn → Explore Paths → Create Path** (or **Wallet & access → Creator Studio**). Any Nimiq wallet can author after a deliberate Creator Studio signature. That approval creates a public creator profile, lasts 15 minutes, cannot send money and cannot publish without separate review. Ordinary learner sign-ins do not gain creator or reviewer scopes. Suspension is enforced on every Studio request.

Creators can edit their public name/bio/optional HTTPS avatar; author private, subject-agnostic Paths; add/reorder up to 24 steps and eight resources per step; choose Free or NIM pricing; preview; save; and submit an immutable review snapshot. Steps have instructions, a starting link, challenge, visible completion criteria and optional preview hints. Profile slugs are assigned by Core when the wallet first signs creator access. Failed saves/expired approval keep unsaved edits on the current screen, not in browser storage. Leaving/reloading loses unsaved edits.

Private **Draft** and **Changes requested** versions can be removed from the Path editor with **Delete draft** and an explicit confirmation. A brand-new abandoned draft also removes its unpublished Path shell. Deleting a draft update never deletes the already-published Path or any learner version. **In review** snapshots cannot be deleted or edited; the reviewer must publish or request changes first so the submitted evidence cannot change underneath review.

The NIM recipient is the signed creator identity, never an editable payout field. Paid listings do not imply active checkout: Core still requires the configured network, payment switch, active creator and approved recipient. The local controlled recipient is the seller wallet, which already owns the `truly-studio` record. Other creators can save/submit paid Paths, but their checkout is not enabled merely by publication. USDT and verified EVM payout editing remain disabled/deferred.

## Wallet-authenticated review

Apply migrations through 0014 before running updated Core. From `worker`:

```sh
npm run db:migrate:local
node scripts/creator-review.mjs setup-wallet PUBLIC_ADMIN_NQ_ADDRESS
```

Setup adds the public address to server-owned `REVIEWER_WALLETS` in ignored `.dev.vars`, preserving existing settings. The user authorized learner `NQ47…2AG1` locally. No production admin is hardcoded. Restart the existing Core process; do not start a duplicate server. Hosted Core must configure its own comma-separated allowlist, never a `VITE_*` variable. Empty/missing configuration grants nobody review access.

1. A creator saves a complete Path and submits it. Its exact revision becomes **In review** and cannot be edited.
2. Connect the authorized admin wallet. Open Creator Studio and approve creator access if needed; **Open review queue** appears only for an authorized wallet.
3. Open the queue and deliberately approve reviewer access. This separate 15-minute signature cannot send money.
4. Select a snapshot. Exercise every step in its real environment and inspect accuracy, content rights, links, visible criteria, environment, price and NIM recipient.
5. Add review notes. **Request changes** rejects with those notes; the creator can revise/save/resubmit. **Approve and publish** requires the explicit review statement and confirmation, and publishes exactly that revision.

The review statement is a human attestation, not automated proof of quality. Core independently checks the live admin allowlist, review scopes, expiry, revision and snapshot state on every decision. Ordinary creator authority cannot publish. The audit receipt records the reviewer wallet. A reviewer may also be a creator; self-review is labelled and recorded, not silently represented as independent approval.

### Operator CLI fallback

The old server-secret CLI remains available to the operator, separate from wallet review. `node scripts/creator-review.mjs setup-local` generates an ignored local key without printing it. Set `CREATOR_REVIEW_TOKEN` only as a server secret for hosted use.

```sh
node scripts/creator-review.mjs list
node scripts/creator-review.mjs show DRAFT_ID
node scripts/creator-review.mjs reject DRAFT_ID REVISION "Clarify what the learner should show."
node scripts/creator-review.mjs publish DRAFT_ID REVISION "Exercised the steps and reviewed resources and criteria."
```

The legacy CLI endpoints refuse browser Origin headers and creator grants; the new wallet queue uses authenticated browser account/CSRF checks. Publication, new version, tags, price and audit receipt commit atomically; collisions roll back everything. Rejection includes notes and permits deliberate revision/resubmission.

The CLI defaults to loopback. Approved hosted review can use `TRULY_REVIEW_CORE_URL=https://...` and an operator `CREATOR_REVIEW_TOKEN` environment value. HTTPS or loopback HTTP only. Never share credentials/signatures in logs or screenshots.

## Frozen updates and public profiles

Draft an update clones a published Path; approval appends a version. Existing learner Tasks keep their original version/content/criteria, title/summary/author snapshot and free/paid access. A formerly free version stays free when the new listing becomes paid. Existing entitlements represent lifetime Path ownership under the current policy.

Tap **By [creator]** on Path detail for the public profile/published library. Public catalog/profile endpoints never expose drafts or private learner Tasks.

Public paid listings show curriculum titles, not step instructions/resources/challenges/criteria. The complete plan is delivered by the authenticated entitlement-checked learner Task/runtime. Only approved versions from non-suspended creators appear in discovery.

## Connect and switch accounts

**Connect wallet** opens a bottom sheet. **Connect through Nimiq Pay** deliberately requests exposed addresses, then the user chooses one; Truly no longer selects the first address automatically. **Wallet & access → Switch account** uses the same chooser. Logout must succeed before a switch commits, and changing identity remounts all private screens/permissions. Purchases, Tasks and paired Macs remain saved under their original owner.

Truly cannot create/import wallets or choose the host's signing account. If only one address appears, select another account inside Nimiq Pay, reopen Truly and refresh accounts. A signature from a different account is rejected by Core with a useful message. Discovery cancellation leaves the current identity untouched. Actual multi-account exposure and host signing require a physical Nimiq Pay test.

Local SQL/signature tests and browser fixtures are not native wallet acceptance, live instructional-quality assessment or payment proof. Run Test CS and the reliability matrix in the living playbook. Test P's first-step assessment/phone-sync/restart slice now passes by user report; full Path completion and negative-case quality remain pending. Permissionless publishing, verified EVM payout editing, marketplace splits, public refund/creator terms, signup abuse hardening and hosting remain outside this beta slice.
