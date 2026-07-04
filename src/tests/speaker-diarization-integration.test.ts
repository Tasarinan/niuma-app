import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeakerDiarization } from '@/hooks/useSpeakerDiarization';
import type { TranscriptEntry } from '@/types';
import * as assemblyAIModule from '@/lib/functions/assemblyai.function';
import * as pitchAnalysisModule from '@/lib/functions/pitch-analysis';
import * as speakerProfilesStorage from '@/lib/storage/speaker-profiles.storage';

// Mock dependencies
vi.mock('@/lib/functions/assemblyai.function');
vi.mock('@/lib/functions/pitch-analysis');
vi.mock('@/lib/storage/speaker-profiles.storage');
vi.mock('@/lib/functions/audio-buffer', () => ({
  DiarizationAudioBuffer: vi.fn().mockImplementation((_duration, callback) => ({
    addSegment: vi.fn(),
    forceFlush: vi.fn(),
    getSegmentCount: vi.fn(() => 0),
    _callback: callback,
  })),
  concatenateAudioBlobs: vi.fn().mockResolvedValue(new Blob()),
}));

describe('Speaker Diarization Integration Tests', () => {
  const mockUpdateEntrySpeaker = vi.fn();
  const mockGetTranscriptEntries = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTranscriptEntries.mockReturnValue([]);
  });

  describe('Complete meeting flow', () => {
    it('should handle multi-speaker meeting with profile matching', async () => {
      // Scenario: 3-person meeting
      // - Speaker A: John (existing profile, male voice ~120Hz)
      // - Speaker B: Sarah (existing profile, female voice ~220Hz)
      // - Speaker C: Unknown (new speaker, male voice ~130Hz)

      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: 'test-key',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
          speakersExpected: 3,
        })
      );

      // Setup existing profiles
      const johnProfile = {
        id: 'john-id',
        name: 'John Doe',
        type: 'colleague' as const,
        color: '#22c55e',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        pitchProfile: {
          minHz: 100,
          maxHz: 180,
          avgHz: 120,
          dominantHz: 118,
          variance: 50,
          sampleCount: 10,
          lastUpdated: Date.now(),
          confidence: 0.9,
        },
        isConfirmed: true,
      };

      const sarahProfile = {
        id: 'sarah-id',
        name: 'Sarah Smith',
        type: 'colleague' as const,
        color: '#f97316',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        pitchProfile: {
          minHz: 200,
          maxHz: 240,
          avgHz: 220,
          dominantHz: 218,
          variance: 40,
          sampleCount: 8,
          lastUpdated: Date.now(),
          confidence: 0.85,
        },
        isConfirmed: true,
      };

      // Mock AssemblyAI response with 3 speakers
      vi.mocked(assemblyAIModule.fetchAssemblyAIWithDiarization).mockResolvedValue({
        transcription: 'Hello. Hi there. Nice to meet you.',
        utterances: [
          { speaker: 'A', text: 'Hello.', start: 0, end: 1000, confidence: 0.95 },
          { speaker: 'B', text: 'Hi there.', start: 1500, end: 3000, confidence: 0.92 },
          { speaker: 'C', text: 'Nice to meet you.', start: 3500, end: 5500, confidence: 0.88 },
        ],
        rawResponse: {},
        audioDurationSeconds: 5.5,
      });

      const now = Date.now();
      const batchStartTime = now;

      // Mock transcript entries
      mockGetTranscriptEntries.mockReturnValue([
        {
          original: 'Hello.',
          timestamp: batchStartTime + 500,
          audioSource: 'system',
        } as TranscriptEntry,
        {
          original: 'Hi there.',
          timestamp: batchStartTime + 2000,
          audioSource: 'system',
        } as TranscriptEntry,
        {
          original: 'Nice to meet you.',
          timestamp: batchStartTime + 4000,
          audioSource: 'system',
        } as TranscriptEntry,
      ]);

      // Mock pitch analysis for each speaker
      let callCount = 0;
      vi.mocked(pitchAnalysisModule.analyzePitch).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // Speaker A - John's voice
          return {
            minHz: 105,
            maxHz: 175,
            avgHz: 122,
            dominantHz: 120,
            variance: 48,
            confidence: 0.87,
          };
        } else if (callCount === 2) {
          // Speaker B - Sarah's voice
          return {
            minHz: 205,
            maxHz: 235,
            avgHz: 218,
            dominantHz: 216,
            variance: 42,
            confidence: 0.83,
          };
        } else {
          // Speaker C - Unknown voice
          return {
            minHz: 110,
            maxHz: 185,
            avgHz: 130,
            dominantHz: 128,
            variance: 55,
            confidence: 0.78,
          };
        }
      });

      // Mock profile matching
      vi.mocked(speakerProfilesStorage.findProfileByPitch).mockImplementation(async (pitchData) => {
        // Match John if avgHz ~120
        if (pitchData.avgHz >= 115 && pitchData.avgHz <= 125) {
          return johnProfile;
        }
        // Match Sarah if avgHz ~220
        if (pitchData.avgHz >= 215 && pitchData.avgHz <= 225) {
          return sarahProfile;
        }
        // No match for Speaker C
        return null;
      });

      // Mock auto-profile creation for unknown speaker
      vi.mocked(speakerProfilesStorage.createAutoProfile).mockResolvedValue({
        id: 'auto-speaker-1',
        name: 'Speaker 1',
        type: 'other',
        color: '#8b5cf6',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        pitchProfile: {} as any,
        isConfirmed: false,
      });

      vi.mocked(speakerProfilesStorage.updateProfilePitch).mockResolvedValue(undefined);

      // Process batch
      const segments = [
        { audio: new Blob(), timestamp: batchStartTime, transcriptEntryId: 'entry-1' },
        { audio: new Blob(), timestamp: batchStartTime + 1500, transcriptEntryId: 'entry-2' },
        { audio: new Blob(), timestamp: batchStartTime + 3500, transcriptEntryId: 'entry-3' },
      ];

      await act(async () => {
        await result.current.processBatch(segments, 'batch-1');
      });

      // Verify all speakers were assigned
      expect(mockUpdateEntrySpeaker).toHaveBeenCalledTimes(3);

      // Verify John was matched (confirmed)
      expect(mockUpdateEntrySpeaker).toHaveBeenCalledWith(
        batchStartTime + 500,
        expect.objectContaining({
          speakerId: 'profile_john-id',
          speakerLabel: 'John Doe',
          confirmed: true,
        })
      );

      // Verify Sarah was matched (confirmed)
      expect(mockUpdateEntrySpeaker).toHaveBeenCalledWith(
        batchStartTime + 2000,
        expect.objectContaining({
          speakerId: 'profile_sarah-id',
          speakerLabel: 'Sarah Smith',
          confirmed: true,
        })
      );

      // Verify unknown speaker got auto-profile (not confirmed)
      expect(mockUpdateEntrySpeaker).toHaveBeenCalledWith(
        batchStartTime + 4000,
        expect.objectContaining({
          speakerId: 'profile_auto-speaker-1',
          speakerLabel: 'Speaker 1',
          confirmed: false,
        })
      );

      // Verify profiles were updated with new pitch data
      expect(speakerProfilesStorage.updateProfilePitch).toHaveBeenCalledWith(
        'john-id',
        expect.any(Object)
      );
      expect(speakerProfilesStorage.updateProfilePitch).toHaveBeenCalledWith(
        'sarah-id',
        expect.any(Object)
      );
    });

    it('should maintain speaker consistency across batches', async () => {
      // Scenario: Same speaker across 2 batches
      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: 'test-key',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
        })
      );

      const profile = {
        id: 'consistent-speaker',
        name: 'Jane',
        type: 'colleague' as const,
        color: '#22c55e',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        pitchProfile: {} as any,
        isConfirmed: true,
      };

      // Mock consistent pitch across batches
      vi.mocked(pitchAnalysisModule.analyzePitch).mockResolvedValue({
        minHz: 180,
        maxHz: 240,
        avgHz: 210,
        dominantHz: 208,
        variance: 45,
        confidence: 0.85,
      });

      // Always match to same profile
      vi.mocked(speakerProfilesStorage.findProfileByPitch).mockResolvedValue(profile);
      vi.mocked(speakerProfilesStorage.updateProfilePitch).mockResolvedValue(undefined);

      // Batch 1
      vi.mocked(assemblyAIModule.fetchAssemblyAIWithDiarization).mockResolvedValueOnce({
        transcription: 'First batch',
        utterances: [
          { speaker: 'A', text: 'First batch', start: 0, end: 1000, confidence: 0.9 },
        ],
        rawResponse: {},
        audioDurationSeconds: 1,
      });

      const now = Date.now();
      mockGetTranscriptEntries.mockReturnValueOnce([
        {
          original: 'First batch',
          timestamp: now,
          audioSource: 'system',
        } as TranscriptEntry,
      ]);

      await act(async () => {
        await result.current.processBatch(
          [{ audio: new Blob(), timestamp: now, transcriptEntryId: 'entry-1' }],
          'batch-1'
        );
      });

      // Batch 2 (30 seconds later)
      vi.mocked(assemblyAIModule.fetchAssemblyAIWithDiarization).mockResolvedValueOnce({
        transcription: 'Second batch',
        utterances: [
          { speaker: 'A', text: 'Second batch', start: 0, end: 1000, confidence: 0.9 },
        ],
        rawResponse: {},
        audioDurationSeconds: 1,
      });

      const batch2Time = now + 30000;
      mockGetTranscriptEntries.mockReturnValueOnce([
        {
          original: 'Second batch',
          timestamp: batch2Time,
          audioSource: 'system',
        } as TranscriptEntry,
      ]);

      await act(async () => {
        await result.current.processBatch(
          [{ audio: new Blob(), timestamp: batch2Time, transcriptEntryId: 'entry-2' }],
          'batch-2'
        );
      });

      // Both batches should use same speaker ID
      const calls = mockUpdateEntrySpeaker.mock.calls;
      expect(calls[0][1].speakerId).toBe('profile_consistent-speaker');
      expect(calls[1][1].speakerId).toBe('profile_consistent-speaker');
    });

    it('should handle long meeting with performance optimization', async () => {
      // Scenario: 2-hour meeting with 500+ transcript entries
      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: 'test-key',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
        })
      );

      vi.mocked(assemblyAIModule.fetchAssemblyAIWithDiarization).mockResolvedValue({
        transcription: 'Recent utterance',
        utterances: [
          { speaker: 'A', text: 'Recent utterance', start: 0, end: 1000, confidence: 0.9 },
        ],
        rawResponse: {},
        audioDurationSeconds: 1,
      });

      // Create 500 old entries + 1 recent entry
      const entries: TranscriptEntry[] = [];
      const now = Date.now();
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;

      // Old entries (should be skipped due to candidate limiting)
      for (let i = 0; i < 500; i++) {
        entries.push({
          original: `Old entry ${i}`,
          timestamp: twoHoursAgo + i * 1000,
          audioSource: 'system',
        } as TranscriptEntry);
      }

      // Recent entry (should be matched)
      entries.push({
        original: 'Recent utterance',
        timestamp: now - 500,
        audioSource: 'system',
      } as TranscriptEntry);

      mockGetTranscriptEntries.mockReturnValue(entries);

      vi.mocked(pitchAnalysisModule.analyzePitch).mockResolvedValue({
        minHz: 100,
        maxHz: 200,
        avgHz: 150,
        dominantHz: 145,
        variance: 50,
        confidence: 0.8,
      });

      vi.mocked(speakerProfilesStorage.findProfileByPitch).mockResolvedValue(null);
      vi.mocked(speakerProfilesStorage.createAutoProfile).mockResolvedValue({
        id: 'speaker-1',
        name: 'Speaker 1',
        type: 'other',
        color: '#22c55e',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        pitchProfile: {} as any,
        isConfirmed: false,
      });

      const startTime = performance.now();

      await act(async () => {
        await result.current.processBatch(
          [{ audio: new Blob(), timestamp: now, transcriptEntryId: 'entry-1' }],
          'batch-1'
        );
      });

      const duration = performance.now() - startTime;

      // Should complete in reasonable time despite 500+ entries
      // (candidate limiting should make this fast)
      expect(duration).toBeLessThan(200); // 200ms threshold

      // Should still match the recent entry correctly
      expect(mockUpdateEntrySpeaker).toHaveBeenCalledWith(
        now - 500,
        expect.any(Object)
      );
    });

    it('should handle speaker profile name change mid-meeting', async () => {
      // Scenario: User renames "Speaker 1" to "John" during meeting
      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: 'test-key',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
        })
      );

      const autoProfile = {
        id: 'auto-1',
        name: 'Speaker 1',
        type: 'other' as const,
        color: '#22c55e',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        pitchProfile: {
          minHz: 100,
          maxHz: 200,
          avgHz: 150,
          dominantHz: 145,
          variance: 50,
          sampleCount: 1,
          lastUpdated: Date.now(),
          confidence: 0.8,
        },
        isConfirmed: false,
      };

      vi.mocked(pitchAnalysisModule.analyzePitch).mockResolvedValue({
        minHz: 100,
        maxHz: 200,
        avgHz: 150,
        dominantHz: 145,
        variance: 50,
        confidence: 0.8,
      });

      // First batch: create auto-profile
      vi.mocked(assemblyAIModule.fetchAssemblyAIWithDiarization).mockResolvedValueOnce({
        transcription: 'First',
        utterances: [
          { speaker: 'A', text: 'First', start: 0, end: 1000, confidence: 0.9 },
        ],
        rawResponse: {},
        audioDurationSeconds: 1,
      });

      const now = Date.now();
      mockGetTranscriptEntries.mockReturnValueOnce([
        {
          original: 'First',
          timestamp: now,
          audioSource: 'system',
        } as TranscriptEntry,
      ]);

      vi.mocked(speakerProfilesStorage.findProfileByPitch).mockResolvedValueOnce(null);
      vi.mocked(speakerProfilesStorage.createAutoProfile).mockResolvedValueOnce(autoProfile);

      await act(async () => {
        await result.current.processBatch(
          [{ audio: new Blob(), timestamp: now, transcriptEntryId: 'entry-1' }],
          'batch-1'
        );
      });

      expect(mockUpdateEntrySpeaker).toHaveBeenCalledWith(
        now,
        expect.objectContaining({
          speakerLabel: 'Speaker 1',
        })
      );

      // Simulate user renaming profile
      const renamedProfile = {
        ...autoProfile,
        name: 'John',
        isAutoGenerated: false,
      };

      // Second batch: should match renamed profile
      vi.mocked(assemblyAIModule.fetchAssemblyAIWithDiarization).mockResolvedValueOnce({
        transcription: 'Second',
        utterances: [
          { speaker: 'A', text: 'Second', start: 0, end: 1000, confidence: 0.9 },
        ],
        rawResponse: {},
        audioDurationSeconds: 1,
      });

      const batch2Time = now + 30000;
      mockGetTranscriptEntries.mockReturnValueOnce([
        {
          original: 'Second',
          timestamp: batch2Time,
          audioSource: 'system',
        } as TranscriptEntry,
      ]);

      vi.mocked(speakerProfilesStorage.findProfileByPitch).mockResolvedValueOnce(renamedProfile);
      vi.mocked(speakerProfilesStorage.updateProfilePitch).mockResolvedValue(undefined);

      await act(async () => {
        await result.current.processBatch(
          [{ audio: new Blob(), timestamp: batch2Time, transcriptEntryId: 'entry-2' }],
          'batch-2'
        );
      });

      expect(mockUpdateEntrySpeaker).toHaveBeenCalledWith(
        batch2Time,
        expect.objectContaining({
          speakerLabel: 'John', // Should use updated name
          confirmed: true, // Now confirmed since user named it
        })
      );
    });
  });
});
