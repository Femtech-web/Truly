-- Backfill only the currently listed version: older versions have no trustworthy
-- historical price to reconstruct. Existing orders/settlements are untouched.
UPDATE skill_versions
SET publication_json = json_set(publication_json, '$.nimPayment', json((
  SELECT json_object('recipient', replace(upper(p.recipient), ' ', ''),
                     'amountAtomic', p.amount_atomic, 'decimals', p.decimals)
  FROM skill_prices p WHERE p.skill_id = skill_versions.skill_id AND p.asset = 'NIM'
)))
WHERE access_kind = 'paid' AND review_status = 'approved'
  AND version = (SELECT current_version FROM skills WHERE id = skill_versions.skill_id)
  AND json_type(publication_json, '$.nimPayment') IS NULL
  AND EXISTS (SELECT 1 FROM skill_prices WHERE skill_id = skill_versions.skill_id AND asset = 'NIM');
