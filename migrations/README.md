# Migrations

Migration 0014 adds the public reviewer-wallet audit field; admin authority comes from server `REVIEWER_WALLETS`, not the migration. Migration 0013 adds private Creator Studio drafts, review receipts and immutable per-version access/presentation snapshots. These preserve pairings, purchases and learner Tasks. Studio-only JSON requests are bounded to 64 KiB; other ordinary JSON limits remain unchanged. Apply before running updated Core.

Ordered Cloudflare D1 migrations establish the Core schema, Nimiq curricula, race-safe pairing claims, the wallet-to-Mac learning handoff, learner-facing catalog language, private learner Tasks, reviewed workspace/resources and Path-backed learner Tasks pinned to a version. Apply locally from `worker` with `npm run db:migrate:local`.

Creator identity/recipients in seeds are explicitly unconfigured and paid prices disabled. The free first Mini App curriculum can enter the learning runtime; paid curricula remain locked until verified settlement grants an entitlement.

Never rewrite an applied migration for schema changes; append a new numbered migration. No remote database is configured yet.

0011 adds sanitized practice receipts, exactly-once passed steps and one active Mac session per Task. It preserves existing pairings and Tasks, pausing only older duplicate active Task sessions if present. Screens/recordings/model evidence are never stored here.

0012 adds immutable, owner-scoped NIM/USDT purchase orders and independently checked settlement records. It does not enable a price or configure a seller. A transaction hash is globally single-use, while entitlement creation remains tied to a validated purchase in the same database batch.
