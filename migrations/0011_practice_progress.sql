-- Only sanitized criterion statuses are durable. No frames, notes or model evidence.
CREATE TABLE practice_attempts (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id),
  wallet_address TEXT NOT NULL REFERENCES wallet_accounts(nimiq_address),
  session_id TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('passed', 'not_passed')),
  criteria_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (device_id, idempotency_key)
);
CREATE UNIQUE INDEX practice_one_pass_per_step ON practice_attempts(scope_id, step_id) WHERE decision = 'passed';
CREATE INDEX practice_session_created ON practice_attempts(session_id, created_at);

-- A Task cannot simultaneously make progress on two Macs.
UPDATE task_learning_sessions SET status = 'paused'
WHERE status = 'active' AND id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY updated_at DESC, id DESC) AS position
    FROM task_learning_sessions WHERE status = 'active'
  ) WHERE position > 1
);
CREATE UNIQUE INDEX task_one_active_session ON task_learning_sessions(task_id) WHERE status = 'active';
