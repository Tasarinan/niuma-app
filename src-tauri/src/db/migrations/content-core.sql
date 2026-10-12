-- Migration 10: Content book (personal style + daily material)
-- Manuscripts stay as Markdown under .artifacts/drafts/.

CREATE TABLE IF NOT EXISTS content_profiles (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  structured_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS content_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  raw_text TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_profiles_version ON content_profiles(version DESC);
CREATE INDEX IF NOT EXISTS idx_content_entries_type ON content_entries(type);
CREATE INDEX IF NOT EXISTS idx_content_entries_occurred_at ON content_entries(occurred_at DESC);
