# Migrations

0015 snapshots each existing current approved NIM listing’s recipient, atomic amount and decimals into its version. 0016 removes a backfilled snapshot when the listing recipient does not match its creator identity; this keeps intentionally unconfigured seed previews disabled. New publications validate and write the snapshot directly. Missing historical prices are not invented; existing orders and learner data are untouched. 0017 expands the immutable order network constraint for `nimiq-mainnet` while preserving historical Testnet orders and their settlement references. 0018 removes stale Testnet wording from the unpurchased Truly-owned seed Path; it is a no-op once that Path has an entitlement. Apply these before deploying the updated payment code. Back up remote D1 first. Rollback is deploying the previous Core version; retain valid snapshots and historical orders rather than rewriting approved history.

Migration 0014 adds the public reviewer-wallet audit field; admin authority comes from server `REVIEWER_WALLETS`, not the migration. Migration 0013 adds private Creator Studio drafts, review receipts and immutable per-version access/presentation snapshots. These preserve pairings, purchases and learner Tasks. Studio-only JSON requests are bounded to 64 KiB; other ordinary JSON limits remain unchanged. Apply before running updated Core.

Ordered Cloudflare D1 migrations establish the Core schema, Nimiq curricula, race-safe pairing claims, the wallet-to-Mac learning handoff, learner-facing catalog language, private learner Tasks, reviewed workspace/resources and Path-backed learner Tasks pinned to a version. Apply locally from `worker` with `npm run db:migrate:local`.

Creator identity/recipients in seeds are explicitly unconfigured and paid prices disabled. The free first Mini App curriculum can enter the learning runtime; paid curricula remain locked until verified settlement grants an entitlement.

Never rewrite an applied migration for schema changes; append a new numbered migration. Production D1 is configured in `worker/wrangler.toml`; `--local` and `--remote` are separate targets.

0011 adds sanitized practice receipts, exactly-once passed steps and one active Mac session per Task. It preserves existing pairings and Tasks, pausing only older duplicate active Task sessions if present. Screens/recordings/model evidence are never stored here.

0012 adds immutable, owner-scoped NIM/USDT purchase orders and independently checked settlement records. It does not enable a price or configure a seller. A transaction hash is globally single-use, while entitlement creation remains tied to a validated purchase in the same database batch.
