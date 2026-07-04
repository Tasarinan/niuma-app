-- Remove foreign key constraint from api_usage table
-- SQLite doesn't support DROP CONSTRAINT, so we recreate the table

-- Create new table without foreign key
CREATE TABLE IF NOT EXISTS api_usage_new (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    message_id TEXT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    audio_seconds REAL,
    estimated_cost REAL,
    timestamp INTEGER NOT NULL
);

-- Copy data from old table
INSERT INTO api_usage_new SELECT * FROM api_usage;

-- Drop old table
DROP TABLE api_usage;

-- Rename new table
ALTER TABLE api_usage_new RENAME TO api_usage;

-- Recreate indexes
CREATE INDEX idx_api_usage_conversation_id ON api_usage(conversation_id);
CREATE INDEX idx_api_usage_timestamp ON api_usage(timestamp DESC);
CREATE INDEX idx_api_usage_provider ON api_usage(provider);
CREATE INDEX idx_api_usage_timestamp_provider ON api_usage(timestamp DESC, provider);
