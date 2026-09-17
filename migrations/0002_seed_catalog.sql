INSERT INTO wallet_accounts (nimiq_address) VALUES
  ('UNCONFIGURED_TRULY_STUDIO_NIM_ADDRESS');

INSERT INTO creators (id, nimiq_address, slug, display_name, bio, status) VALUES
  ('creator_truly_studio', 'UNCONFIGURED_TRULY_STUDIO_NIM_ADDRESS', 'truly-studio', 'Truly Studio', 'Practical learning Skills built for the Nimiq ecosystem.', 'invited');

INSERT INTO tags (id, slug, label, family) VALUES
  ('tag_web3', 'web3', 'Web3', 'subject'),
  ('tag_nimiq', 'nimiq', 'Nimiq', 'subject'),
  ('tag_programming', 'programming', 'Programming', 'subject'),
  ('tag_mini_apps', 'mini-apps', 'Mini Apps', 'tool'),
  ('tag_react', 'react', 'React', 'tool'),
  ('tag_beginner', 'beginner', 'Beginner', 'level'),
  ('tag_intermediate', 'intermediate', 'Intermediate', 'level'),
  ('tag_project', 'project-based', 'Project-based', 'format');

INSERT INTO skills (id, creator_id, slug, title, summary, description, category, status, current_version) VALUES
  ('skill_nimiq_first_mini_app', 'creator_truly_studio', 'build-your-first-nimiq-mini-app', 'Build your first Nimiq Mini App', 'Connect a real Nimiq wallet from a mobile-first Mini App.', 'Learn the Nimiq Pay host model, initialize the provider, request an account after a clear action, and handle approval or rejection correctly.', 'Web3 development', 'published', 1),
  ('skill_nim_payments', 'creator_truly_studio', 'nim-payments-that-users-trust', 'NIM payments users can trust', 'Build a clear NIM checkout with native approval and safe failure handling.', 'Implement prices in Luna, preview the recipient and amount, submit a NIM payment, and keep entitlement authority on the server.', 'Web3 development', 'published', 1),
  ('skill_dual_asset_checkout', 'creator_truly_studio', 'dual-asset-checkout-nim-usdt', 'Dual-asset checkout: NIM + USDT', 'Offer NIM and USDT without making wallet approval confusing.', 'Build a dual-provider checkout using native NIM and Polygon USDT, correct token decimals, explicit chain selection, and independently validated settlement.', 'Web3 development', 'published', 1);

INSERT INTO skill_tags (skill_id, tag_id) VALUES
  ('skill_nimiq_first_mini_app', 'tag_web3'),
  ('skill_nimiq_first_mini_app', 'tag_nimiq'),
  ('skill_nimiq_first_mini_app', 'tag_programming'),
  ('skill_nimiq_first_mini_app', 'tag_mini_apps'),
  ('skill_nimiq_first_mini_app', 'tag_react'),
  ('skill_nimiq_first_mini_app', 'tag_beginner'),
  ('skill_nimiq_first_mini_app', 'tag_project'),
  ('skill_nim_payments', 'tag_web3'),
  ('skill_nim_payments', 'tag_nimiq'),
  ('skill_nim_payments', 'tag_programming'),
  ('skill_nim_payments', 'tag_intermediate'),
  ('skill_dual_asset_checkout', 'tag_web3'),
  ('skill_dual_asset_checkout', 'tag_nimiq'),
  ('skill_dual_asset_checkout', 'tag_programming'),
  ('skill_dual_asset_checkout', 'tag_intermediate');

INSERT INTO skill_versions (id, skill_id, version, manifest_json, review_status, published_at) VALUES
  ('version_nimiq_first_mini_app_1', 'skill_nimiq_first_mini_app', 1, '{"schemaVersion":1,"outcomes":["Explain the Nimiq Pay WebView host model","Initialize the Nimiq provider","Request wallet access only after a user action"],"supportedEnvironments":["macOS","VS Code"],"steps":[{"id":"provider","title":"Initialize the provider"},{"id":"account","title":"Connect after a clear action"},{"id":"recovery","title":"Handle rejection safely"}]}', 'approved', CURRENT_TIMESTAMP),
  ('version_nim_payments_1', 'skill_nim_payments', 1, '{"schemaVersion":1,"outcomes":["Convert NIM to Luna safely","Present a clear checkout","Keep entitlement authority on the server"],"supportedEnvironments":["macOS","VS Code"],"steps":[{"id":"price","title":"Represent the amount"},{"id":"preview","title":"Show what will happen"},{"id":"submit","title":"Submit and validate"}]}', 'approved', CURRENT_TIMESTAMP),
  ('version_dual_asset_checkout_1', 'skill_dual_asset_checkout', 1, '{"schemaVersion":1,"outcomes":["Offer NIM and USDT safely","Use six USDT decimals","Switch chains explicitly"],"supportedEnvironments":["macOS","VS Code"],"steps":[{"id":"assets","title":"Model both assets"},{"id":"chain","title":"Select Polygon"},{"id":"settlement","title":"Validate settlement"}]}', 'approved', CURRENT_TIMESTAMP);

INSERT INTO skill_prices (id, skill_id, asset, chain_id, token_address, decimals, amount_atomic, recipient, active) VALUES
  ('price_nim_payments_nim', 'skill_nim_payments', 'NIM', NULL, NULL, 5, '190000', 'UNCONFIGURED_TRULY_STUDIO_NIM_ADDRESS', 0),
  ('price_nim_payments_usdt', 'skill_nim_payments', 'USDT', '0x89', '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 6, '2000000', 'UNCONFIGURED_TRULY_STUDIO_EVM_ADDRESS', 0),
  ('price_dual_nim', 'skill_dual_asset_checkout', 'NIM', NULL, NULL, 5, '290000', 'UNCONFIGURED_TRULY_STUDIO_NIM_ADDRESS', 0),
  ('price_dual_usdt', 'skill_dual_asset_checkout', 'USDT', '0x89', '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 6, '3000000', 'UNCONFIGURED_TRULY_STUDIO_EVM_ADDRESS', 0);
