-- Meeting Transcript Snapshots (Migration 9)
-- Stores saved transcript snapshots for the meeting channel.

CREATE TABLE IF NOT EXISTS meeting_snapshots (
    id          TEXT    PRIMARY KEY NOT NULL,
    title       TEXT    NOT NULL,
    transcript  TEXT    NOT NULL,
    entry_count INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meeting_snapshots_created_at
    ON meeting_snapshots(created_at DESC);
