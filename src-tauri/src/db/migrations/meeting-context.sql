-- Meeting Context Memory Feature Tables (Migration v6)
-- Stores AI-generated summaries, extracted entities, and knowledge profiles

-- Table 1: meeting_summaries
-- Stores AI-generated summaries per conversation session
CREATE TABLE IF NOT EXISTS meeting_summaries (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL UNIQUE,
    summary TEXT NOT NULL,
    topics TEXT,             -- JSON array: ["topic1", "topic2"]
    action_items TEXT,       -- JSON array of action items
    decisions TEXT,          -- JSON array of decisions made
    participants TEXT,       -- JSON array of mentioned people
    exchange_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Indexes for meeting_summaries
CREATE INDEX IF NOT EXISTS idx_meeting_summaries_conversation_id ON meeting_summaries(conversation_id);
CREATE INDEX IF NOT EXISTS idx_meeting_summaries_created_at ON meeting_summaries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_summaries_updated_at ON meeting_summaries(updated_at DESC);

-- Table 2: knowledge_entities
-- Extracted entities (people, projects, terms, companies)
CREATE TABLE IF NOT EXISTS knowledge_entities (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('person', 'project', 'term', 'company')),
    name TEXT NOT NULL,
    description TEXT,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    mention_count INTEGER DEFAULT 1,
    UNIQUE(entity_type, name)
);

-- Indexes for knowledge_entities
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_type ON knowledge_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_name ON knowledge_entities(name);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_last_seen ON knowledge_entities(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_mention_count ON knowledge_entities(mention_count DESC);

-- Table 3: entity_mentions
-- Many-to-many link between entities and summaries
CREATE TABLE IF NOT EXISTS entity_mentions (
    entity_id TEXT NOT NULL,
    summary_id TEXT NOT NULL,
    PRIMARY KEY (entity_id, summary_id),
    FOREIGN KEY (entity_id) REFERENCES knowledge_entities(id) ON DELETE CASCADE,
    FOREIGN KEY (summary_id) REFERENCES meeting_summaries(id) ON DELETE CASCADE
);

-- Indexes for entity_mentions
CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity_id ON entity_mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_summary_id ON entity_mentions(summary_id);

-- Table 4: knowledge_profile
-- Compacted long-term memory (single row design)
CREATE TABLE IF NOT EXISTS knowledge_profile (
    id TEXT PRIMARY KEY DEFAULT 'profile' CHECK(id = 'profile'),
    summary TEXT,            -- Compacted profile summary
    key_people TEXT,         -- JSON: Most important people
    key_projects TEXT,       -- JSON: Active projects
    terminology TEXT,        -- JSON: Domain-specific terms
    last_compacted INTEGER,  -- Timestamp of last compaction
    source_count INTEGER DEFAULT 0  -- Number of summaries compacted
);

-- Initialize knowledge_profile with empty row
INSERT OR IGNORE INTO knowledge_profile (id, source_count) VALUES ('profile', 0);
