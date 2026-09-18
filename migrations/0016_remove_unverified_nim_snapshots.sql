-- Never retain a backfilled payment snapshot unless the current listing pays
-- the same valid-looking Nimiq address that authenticated the creator profile.
UPDATE skill_versions
SET publication_json = json_remove(publication_json, '$.nimPayment')
WHERE version = (SELECT current_version FROM skills WHERE id = skill_versions.skill_id)
  AND json_type(publication_json, '$.nimPayment') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM skills s
    JOIN creators c ON c.id = s.creator_id
    JOIN skill_prices p ON p.skill_id = s.id AND p.asset = 'NIM'
    WHERE s.id = skill_versions.skill_id
      AND replace(upper(p.recipient), ' ', '') = replace(upper(c.nimiq_address), ' ', '')
      AND length(replace(upper(c.nimiq_address), ' ', '')) = 36
      AND substr(replace(upper(c.nimiq_address), ' ', ''), 1, 2) = 'NQ'
  );
