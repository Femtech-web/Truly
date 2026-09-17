UPDATE skills SET
  summary = 'Build a simple Mini App that connects to a real Nimiq wallet.',
  description = 'Let Truly guide you from your app to a clear, safe wallet connection inside Nimiq Pay.',
  category = 'Nimiq Mini Apps'
WHERE id = 'skill_nimiq_first_mini_app';

UPDATE skills SET
  summary = 'Create a NIM checkout that shows people exactly what they are paying for.',
  description = 'Show a clear price, ask for approval at the right moment, and confirm payment before unlocking access.',
  category = 'NIM payments'
WHERE id = 'skill_nim_payments';

UPDATE skills SET
  title = 'Let people pay with NIM or USDT',
  summary = 'Give people a clear choice between NIM and USDT.',
  description = 'Build a checkout where people can choose how to pay and always know what will happen next.',
  category = 'NIM + USDT'
WHERE id = 'skill_dual_asset_checkout';

UPDATE skill_versions SET manifest_json = '{"schemaVersion":1,"outcomes":["Understand how a Mini App works inside Nimiq Pay","Connect a wallet only when the person chooses","Keep the app calm if they cancel"],"prerequisites":["A paired Mac with Truly open","A place to build your Mini App","No previous Nimiq experience needed"],"supportedEnvironments":["Mac","VS Code","Browser"],"estimatedMinutes":30,"steps":[{"id":"provider","title":"Connect your app to Nimiq Pay","summary":"Let Truly guide you through adding the Nimiq connection to your app."},{"id":"account","title":"Add a clear Connect wallet button","summary":"Ask for wallet access only after the person chooses to connect."},{"id":"recovery","title":"Make cancellation feel safe","summary":"Keep the app useful when someone closes or declines the wallet request."}]}'
WHERE id = 'version_nimiq_first_mini_app_1';

UPDATE skill_versions SET manifest_json = '{"schemaVersion":1,"outcomes":["Show NIM prices clearly","Let people review a payment before approving","Unlock access only after payment is confirmed"],"prerequisites":["A paired Mac with Truly open","A Nimiq Pay test account","A checkout screen to practise with"],"supportedEnvironments":["Mac","VS Code","Browser"],"estimatedMinutes":35,"steps":[{"id":"price","title":"Set a clear price","summary":"Show the amount in a way people can understand at a glance."},{"id":"preview","title":"Show a simple payment review","summary":"Let people check what they are paying and who receives it before approval."},{"id":"submit","title":"Confirm before unlocking","summary":"Wait for a successful payment before giving access to the Skill."}]}'
WHERE id = 'version_nim_payments_1';

UPDATE skill_versions SET manifest_json = '{"schemaVersion":1,"outcomes":["Offer NIM and USDT as clear choices","Prepare USDT on the right network","Unlock access only after payment is confirmed"],"prerequisites":["A paired Mac with Truly open","A Nimiq Pay account","A checkout screen to practise with"],"supportedEnvironments":["Mac","VS Code","Browser"],"estimatedMinutes":45,"steps":[{"id":"assets","title":"Offer both payment choices","summary":"Present NIM and USDT clearly so people can choose with confidence."},{"id":"chain","title":"Prepare the USDT payment","summary":"Help the wallet use the right network before asking for approval."},{"id":"settlement","title":"Confirm before unlocking","summary":"Wait for a successful payment before giving access to the Skill."}]}'
WHERE id = 'version_dual_asset_checkout_1';
