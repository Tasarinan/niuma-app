-- Add audio_seconds column for STT usage tracking
-- This column stores the duration of audio in seconds for Speech-to-Text API calls
ALTER TABLE api_usage ADD COLUMN audio_seconds REAL;
