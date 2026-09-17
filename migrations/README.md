# Migrations

Ordered Cloudflare D1 migrations establish the Core schema, Nimiq curricula, race-safe pairing claims, the wallet-to-Mac learning handoff, learner-facing catalog language, private learner Tasks, reviewed workspace/resources and Path-backed learner Tasks pinned to a version. Apply locally from `worker` with `npm run db:migrate:local`.

Creator identity/recipients in seeds are explicitly unconfigured and paid prices disabled. The free first Mini App curriculum can enter the learning runtime; paid curricula remain locked until verified settlement grants an entitlement.

Never rewrite an applied migration for schema changes; append a new numbered migration. No remote database is configured yet.
