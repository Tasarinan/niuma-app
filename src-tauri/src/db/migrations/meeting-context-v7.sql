-- Meeting Context Memory Enhancement (Migration v7)
-- Adds additional fields for meeting summaries and knowledge profiles

-- Add new fields to meeting_summaries table
ALTER TABLE meeting_summaries ADD COLUMN title TEXT;
ALTER TABLE meeting_summaries ADD COLUMN goals TEXT;          -- JSON array of meeting goals
ALTER TABLE meeting_summaries ADD COLUMN next_steps TEXT;     -- JSON array of next steps
ALTER TABLE meeting_summaries ADD COLUMN team_updates TEXT;   -- JSON array of team updates
ALTER TABLE meeting_summaries ADD COLUMN duration_seconds INTEGER;  -- Meeting duration

-- Add new fields to knowledge_profile table
ALTER TABLE knowledge_profile ADD COLUMN recent_goals TEXT;         -- JSON array of recent goals
ALTER TABLE knowledge_profile ADD COLUMN recent_decisions TEXT;     -- JSON array of recent decisions
ALTER TABLE knowledge_profile ADD COLUMN recent_team_updates TEXT;  -- JSON array of recent team updates
