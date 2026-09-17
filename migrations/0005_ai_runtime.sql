CREATE TABLE ai_request_leases (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX ai_request_leases_expiry ON ai_request_leases(expires_at);
CREATE INDEX ai_request_leases_device ON ai_request_leases(device_id, expires_at);
