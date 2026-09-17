ALTER TABLE learning_tasks ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'direct'
  CHECK (source_kind IN ('direct', 'path'));
ALTER TABLE learning_tasks ADD COLUMN source_skill_id TEXT;
ALTER TABLE learning_tasks ADD COLUMN source_skill_version INTEGER;

CREATE UNIQUE INDEX learning_tasks_one_per_path_version
  ON learning_tasks(wallet_address, source_skill_id, source_skill_version)
  WHERE source_kind = 'path' AND source_skill_id IS NOT NULL AND source_skill_version IS NOT NULL;
