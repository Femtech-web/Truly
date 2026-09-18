-- Remove stale Testnet wording from Truly's seed Path before Mainnet checkout
-- is enabled. Production currently has no orders or entitlements for this Path;
-- future creator publications remain immutable version snapshots.
UPDATE skill_versions
SET manifest_json = json_set(
  manifest_json,
  '$.prerequisites[1]',
  'A Nimiq Pay account'
)
WHERE id = 'version_nim_payments_1'
  AND json_extract(manifest_json, '$.prerequisites[1]') IN (
    'A Nimiq Pay test account',
    'A Nimiq Pay testnet account'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM entitlements
    WHERE entitlements.skill_id = skill_versions.skill_id
  );
