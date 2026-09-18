-- Publication policy is pinned per version, not inferred from today's listing.
ALTER TABLE skill_versions ADD COLUMN access_kind TEXT NOT NULL DEFAULT 'free' CHECK (access_kind IN ('free', 'paid'));
ALTER TABLE skill_versions ADD COLUMN publication_json TEXT NOT NULL DEFAULT '{}';
UPDATE skill_versions SET access_kind = 'paid' WHERE EXISTS (SELECT 1 FROM skill_prices WHERE skill_id = skill_versions.skill_id);
UPDATE skill_versions SET publication_json = (SELECT json_object('title', s.title, 'summary', s.summary, 'creatorName', c.display_name)
  FROM skills s JOIN creators c ON c.id = s.creator_id WHERE s.id = skill_versions.skill_id);

CREATE TABLE creator_drafts (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  skill_id TEXT NOT NULL REFERENCES skills(id),
  base_version INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  document_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'rejected')),
  review_note TEXT NOT NULL DEFAULT '',
  publication_claim TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX creator_open_draft ON creator_drafts(skill_id) WHERE status IN ('draft', 'review');
CREATE TABLE creator_reviews (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES creator_drafts(id),
  revision INTEGER NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('published', 'rejected')),
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
