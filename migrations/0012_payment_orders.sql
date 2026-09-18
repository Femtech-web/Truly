-- Quotes are immutable; callbacks never create access without independent settlement.
CREATE TABLE payment_orders (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallet_accounts(nimiq_address),
  skill_id TEXT NOT NULL REFERENCES skills(id),
  skill_version INTEGER NOT NULL,
  asset TEXT NOT NULL CHECK(asset IN ('NIM','USDT')),
  network TEXT NOT NULL CHECK(network IN ('nimiq-testnet','polygon')),
  token_address TEXT,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  amount_atomic TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  request_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  binding_nonce TEXT NOT NULL,
  sender_verified_at TEXT,
  transaction_hash TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'quoted' CHECK(status IN ('quoted','submitted','validated','rejected')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  validated_at TEXT,
  UNIQUE(wallet_address,request_key)
);
CREATE INDEX payment_orders_owner ON payment_orders(wallet_address,created_at DESC);
CREATE UNIQUE INDEX payment_orders_open_path ON payment_orders(wallet_address,skill_id) WHERE status IN ('quoted','submitted');
CREATE TABLE payment_settlements (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES payment_orders(id),
  network TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  block_number TEXT NOT NULL,
  block_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(network,transaction_hash)
);
