CREATE TABLE wallet_auth_challenges (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  claim TEXT
);
CREATE TABLE wallet_sessions (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallet_accounts(nimiq_address),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL
);
CREATE INDEX wallet_sessions_expiry ON wallet_sessions(expires_at);
CREATE TABLE rate_limit_windows (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX rate_limit_expiry ON rate_limit_windows(expires_at);
