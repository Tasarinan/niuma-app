-- Migration 8: Health data core tables
-- Stores personal health records, attachments, observations, and AI interpretations.

CREATE TABLE IF NOT EXISTS health_people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  relation TEXT NOT NULL DEFAULT 'self',
  birth_date TEXT,
  sex TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS health_records (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES health_people(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  confidence REAL,
  raw_text TEXT,
  structured_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS health_attachments (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES health_records(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  sha256 TEXT,
  size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS health_observations (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES health_records(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES health_people(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  value_num REAL,
  value_text TEXT,
  unit TEXT,
  reference_low REAL,
  reference_high REAL,
  abnormal_flag TEXT,
  confidence REAL,
  observed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS health_ai_interpretations (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES health_records(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  result_json TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  warnings_json TEXT NOT NULL DEFAULT '[]',
  confidence REAL,
  created_at INTEGER NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_health_records_person_id ON health_records(person_id);
CREATE INDEX IF NOT EXISTS idx_health_records_type ON health_records(type);
CREATE INDEX IF NOT EXISTS idx_health_records_occurred_at ON health_records(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_attachments_record_id ON health_attachments(record_id);
CREATE INDEX IF NOT EXISTS idx_health_observations_person_id ON health_observations(person_id);
CREATE INDEX IF NOT EXISTS idx_health_observations_code ON health_observations(code);
CREATE INDEX IF NOT EXISTS idx_health_observations_observed_at ON health_observations(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_observations_record_id ON health_observations(record_id);
CREATE INDEX IF NOT EXISTS idx_health_ai_interpretations_record_id ON health_ai_interpretations(record_id);
