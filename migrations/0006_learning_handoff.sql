ALTER TABLE wallet_auth_challenges
  ADD COLUMN scopes TEXT NOT NULL DEFAULT 'devices:read devices:revoke';

ALTER TABLE wallet_sessions
  ADD COLUMN scopes TEXT NOT NULL DEFAULT 'devices:read devices:revoke';

ALTER TABLE learning_sessions ADD COLUMN updated_at TEXT;
UPDATE learning_sessions SET updated_at = COALESCE(completed_at, started_at) WHERE updated_at IS NULL;

CREATE UNIQUE INDEX learning_sessions_one_active_per_device
  ON learning_sessions(device_id) WHERE status = 'active';
CREATE INDEX learning_sessions_wallet_status
  ON learning_sessions(wallet_address, status, updated_at);

CREATE TABLE learning_activation_requests (
  wallet_address TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  device_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  skill_version INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (wallet_address, idempotency_key),
  FOREIGN KEY (wallet_address) REFERENCES wallet_accounts(nimiq_address),
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (skill_id) REFERENCES skills(id),
  FOREIGN KEY (session_id) REFERENCES learning_sessions(id)
);

UPDATE skill_versions SET manifest_json = '{"schemaVersion":1,"outcomes":["Explain the Nimiq Pay WebView host model","Initialize the Nimiq provider through the Mini App SDK","Request wallet access only after a clear user action"],"prerequisites":["A paired Mac running Truly","Node.js 22 or later","A code editor"],"supportedEnvironments":["macOS","VS Code","Browser"],"estimatedMinutes":30,"steps":[{"id":"provider","title":"Initialize the provider","summary":"Install the Mini App SDK and initialize the injected Nimiq provider in the app setup path."},{"id":"account","title":"Connect after a clear action","summary":"Request account access only after the learner presses a clear connect control."},{"id":"recovery","title":"Handle rejection safely","summary":"Keep the interface usable when the wallet request is cancelled or unavailable."}]}'
WHERE id = 'version_nimiq_first_mini_app_1';

UPDATE skill_versions SET manifest_json = '{"schemaVersion":1,"outcomes":["Convert NIM to Luna safely","Present a clear checkout","Keep entitlement authority on the server"],"prerequisites":["A paired Mac running Truly","A Nimiq Pay testnet account","Basic JavaScript knowledge"],"supportedEnvironments":["macOS","VS Code","Browser"],"estimatedMinutes":35,"steps":[{"id":"price","title":"Represent the amount","summary":"Convert the displayed NIM price to exact integer Luna without floating-point ambiguity."},{"id":"preview","title":"Show what will happen","summary":"Present the asset, amount, recipient and result before opening native approval."},{"id":"submit","title":"Submit and validate","summary":"Send the transaction and let Core independently validate settlement before access changes."}]}'
WHERE id = 'version_nim_payments_1';

UPDATE skill_versions SET manifest_json = '{"schemaVersion":1,"outcomes":["Offer NIM and USDT safely","Use six USDT decimals","Switch chains explicitly"],"prerequisites":["A paired Mac running Truly","A Nimiq Pay account","Basic NIM and EVM transaction knowledge"],"supportedEnvironments":["macOS","VS Code","Browser"],"estimatedMinutes":45,"steps":[{"id":"assets","title":"Model both assets","summary":"Represent NIM and USDT as distinct assets with their correct units and networks."},{"id":"chain","title":"Select Polygon","summary":"Request the intended EVM chain explicitly before preparing a USDT transfer."},{"id":"settlement","title":"Validate settlement","summary":"Verify chain, token, sender, recipient, amount and receipt before granting access."}]}'
WHERE id = 'version_dual_asset_checkout_1';
