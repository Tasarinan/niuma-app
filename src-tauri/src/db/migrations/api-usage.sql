-- API Usage Tracking Table
-- Stores token usage and estimated costs per API request

CREATE TABLE IF NOT EXISTS api_usage (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    message_id TEXT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    estimated_cost REAL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Index for querying by conversation
CREATE INDEX idx_api_usage_conversation_id ON api_usage(conversation_id);

-- Index for querying by timestamp (for daily/monthly summaries)
CREATE INDEX idx_api_usage_timestamp ON api_usage(timestamp DESC);

-- Index for querying by provider (for provider breakdowns)
CREATE INDEX idx_api_usage_provider ON api_usage(provider);

-- Composite index for efficient date range queries with provider filtering
CREATE INDEX idx_api_usage_timestamp_provider ON api_usage(timestamp DESC, provider);
