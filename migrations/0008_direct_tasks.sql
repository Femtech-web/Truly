PRAGMA foreign_keys = ON;

CREATE TABLE learning_tasks (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  goal TEXT NOT NULL,
  title TEXT NOT NULL,
  outcome TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wallet_address) REFERENCES wallet_accounts(nimiq_address)
);

CREATE INDEX learning_tasks_wallet_updated
  ON learning_tasks(wallet_address, updated_at DESC);

CREATE TABLE task_learning_sessions (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  device_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed')),
  current_step TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (wallet_address) REFERENCES wallet_accounts(nimiq_address),
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (task_id) REFERENCES learning_tasks(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX task_learning_sessions_one_active_per_device
  ON task_learning_sessions(device_id) WHERE status = 'active';
CREATE INDEX task_learning_sessions_wallet_status
  ON task_learning_sessions(wallet_address, status, updated_at DESC);

CREATE TABLE task_activation_requests (
  wallet_address TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  device_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (wallet_address, idempotency_key),
  FOREIGN KEY (wallet_address) REFERENCES wallet_accounts(nimiq_address),
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (task_id) REFERENCES learning_tasks(id),
  FOREIGN KEY (session_id) REFERENCES task_learning_sessions(id)
);
