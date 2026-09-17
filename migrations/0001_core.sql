PRAGMA foreign_keys = ON;

CREATE TABLE wallet_accounts (
  nimiq_address TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE creators (
  id TEXT PRIMARY KEY,
  nimiq_address TEXT NOT NULL UNIQUE,
  evm_address TEXT,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (nimiq_address) REFERENCES wallet_accounts(nimiq_address)
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  family TEXT NOT NULL CHECK (family IN ('subject', 'tool', 'level', 'format', 'language'))
);

CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES creators(id)
);

CREATE TABLE skill_tags (
  skill_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (skill_id, tag_id),
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE skill_versions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  manifest_json TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'review', 'approved', 'rejected')),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (skill_id, version),
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

CREATE TABLE skill_prices (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  asset TEXT NOT NULL CHECK (asset IN ('NIM', 'USDT')),
  chain_id TEXT,
  token_address TEXT,
  decimals INTEGER NOT NULL,
  amount_atomic TEXT NOT NULL,
  recipient TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (skill_id, asset, chain_id),
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

CREATE TABLE pairing_challenges (
  id TEXT PRIMARY KEY,
  device_install_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  nonce TEXT NOT NULL UNIQUE,
  exchange_secret_hash TEXT NOT NULL,
  miniapp_origin TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'exchanged', 'expired', 'cancelled')),
  approved_wallet TEXT,
  device_id TEXT,
  public_key TEXT,
  completed_at TEXT,
  exchanged_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX pairing_challenges_device_index ON pairing_challenges(device_install_id, created_at DESC);
CREATE INDEX pairing_challenges_expiry_index ON pairing_challenges(status, expires_at);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  install_id TEXT NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT,
  revoked_at TEXT,
  UNIQUE (wallet_address, install_id),
  FOREIGN KEY (wallet_address) REFERENCES wallet_accounts(nimiq_address)
);

CREATE TABLE desktop_sessions (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE entitlements (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('free', 'purchase', 'grant')),
  purchase_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (wallet_address, skill_id),
  FOREIGN KEY (wallet_address) REFERENCES wallet_accounts(nimiq_address),
  FOREIGN KEY (skill_id) REFERENCES skills(id)
);

CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  asset TEXT NOT NULL CHECK (asset IN ('NIM', 'USDT')),
  chain_id TEXT,
  transaction_hash TEXT NOT NULL UNIQUE,
  recipient TEXT NOT NULL,
  amount_atomic TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('submitted', 'validated', 'rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validated_at TEXT,
  FOREIGN KEY (wallet_address) REFERENCES wallet_accounts(nimiq_address),
  FOREIGN KEY (skill_id) REFERENCES skills(id)
);

CREATE TABLE learning_sessions (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  device_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  skill_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed')),
  current_step TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (wallet_address) REFERENCES wallet_accounts(nimiq_address),
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (skill_id) REFERENCES skills(id)
);

CREATE TABLE progress_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  step_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES learning_sessions(id) ON DELETE CASCADE
);
