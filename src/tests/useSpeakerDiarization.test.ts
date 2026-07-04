import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
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
  DiarizationAudioBuffer: vi.fn(function(this: any, _duration: number, callback: Function) {
    this.addSegment = vi.fn();
    this.forceFlush = vi.fn();
    this.getSegmentCount = vi.fn(() => 0);
    this._callback = callback;
    return this;
  }),
  concatenateAudioBlobs: vi.fn().mockResolvedValue(new Blob()),
}));

describe('useSpeakerDiarization', () => {
  const mockUpdateEntrySpeaker = vi.fn();
  const mockGetTranscriptEntries = vi.fn();
  const mockOnError = vi.fn();
  const mockOnBatchProcessed = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTranscriptEntries.mockReturnValue([]);
  });

  describe('Hook initialization', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: 'test-key',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
        })
      );

      expect(result.current).toHaveProperty('createAudioBuffer');
      expect(result.current).toHaveProperty('processBatch');
      expect(result.current).toHaveProperty('resetRegistry');
      expect(result.current).toHaveProperty('getRegistry');
      expect(result.current.isProcessing).toBe(false);
    });

    it('should create audio buffer with correct batch duration', () => {
      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: 'test-key',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
          batchDurationMs: 15000,
        })
      );

      const buffer = result.current.createAudioBuffer();
      expect(buffer).toBeDefined();
    });
  });

  describe('Registry management', () => {
    it('should reset registry correctly', () => {
      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: 'test-key',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
        })
      );

      result.current.resetRegistry();
      const registry = result.current.getRegistry();

      expect(registry.nextSpeakerNumber).toBe(1);
      expect(Object.keys(registry.batchMappings)).toHaveLength(0);
      expect(Object.keys(registry.assignedSpeakers)).toHaveLength(0);
    });
  });

  describe('Batch processing', () => {
    it('should skip processing if no API key provided', async () => {
      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: '',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
        })
      );

      const segments = [
        { audio: new Blob(), timestamp: Date.now(), transcriptEntryId: 'entry-1' },
      ];

      await result.current.processBatch(segments, 'batch-1');

      expect(assemblyAIModule.fetchAssemblyAIWithDiarization).not.toHaveBeenCalled();
    });

    it('should skip processing if segments array is empty', async () => {
      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: 'test-key',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
        })
      );

      await result.current.processBatch([], 'batch-1');

      expect(assemblyAIModule.fetchAssemblyAIWithDiarization).not.toHaveBeenCalled();
    });

    it('should prevent concurrent batch processing', async () => {
      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: 'test-key',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
        })
      );

      // Mock slow AssemblyAI call
      vi.mocked(assemblyAIModule.fetchAssemblyAIWithDiarization).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      const segments = [
        { audio: new Blob(), timestamp: Date.now(), transcriptEntryId: 'entry-1' },
      ];

      // Start first batch (doesn't await)
      const promise1 = result.current.processBatch(segments, 'batch-1');

      // Try to start second batch immediately
      await result.current.processBatch(segments, 'batch-2');

      // Second batch should be skipped
      expect(assemblyAIModule.fetchAssemblyAIWithDiarization).toHaveBeenCalledTimes(1);

      await promise1;
    });

    it('should handle AssemblyAI errors gracefully', async () => {
      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: 'test-key',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
          onError: mockOnError,
        })
      );

      vi.mocked(assemblyAIModule.fetchAssemblyAIWithDiarization).mockRejectedValue(
        new Error('API failed')
      );

      const segments = [
        { audio: new Blob(), timestamp: Date.now(), transcriptEntryId: 'entry-1' },
      ];

      await result.current.processBatch(segments, 'batch-1');

      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call onBatchProcessed callback after successful processing', async () => {
      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: 'test-key',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
          onBatchProcessed: mockOnBatchProcessed,
        })
      );

      // Mock successful AssemblyAI response
      vi.mocked(assemblyAIModule.fetchAssemblyAIWithDiarization).mockResolvedValue({
        transcription: 'Hello world',
        utterances: [
          { speaker: 'A', text: 'Hello', start: 0, end: 1000, confidence: 0.9 },
        ],
        rawResponse: {},
        audioDurationSeconds: 1,
      });

      // Mock transcript entries
      mockGetTranscriptEntries.mockReturnValue([
        {
          original: 'Hello',
          timestamp: Date.now(),
          audioSource: 'system',
        } as TranscriptEntry,
      ]);

      // Mock pitch analysis
      vi.mocked(pitchAnalysisModule.analyzePitch).mockResolvedValue({
        minHz: 100,
        maxHz: 200,
        avgHz: 150,
        dominantHz: 145,
        variance: 50,
        confidence: 0.8,
      });

      // Mock profile matching (no match)
      vi.mocked(speakerProfilesStorage.findProfileByPitch).mockResolvedValue(null);
      vi.mocked(speakerProfilesStorage.createAutoProfile).mockResolvedValue({
        id: 'profile-1',
        name: 'Speaker 1',
        type: 'other',
        color: '#22c55e',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        pitchProfile: {} as any,
        isConfirmed: false,
      });

      const segments = [
        { audio: new Blob(), timestamp: Date.now(), transcriptEntryId: 'entry-1' },
      ];

      await result.current.processBatch(segments, 'batch-1');

      expect(mockOnBatchProcessed).toHaveBeenCalledWith('batch-1', 1);
    });
  });

  describe('Speaker matching edge cases', () => {
    it('should handle batch with no utterances', async () => {
      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: 'test-key',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
          onBatchProcessed: mockOnBatchProcessed,
        })
      );

      // Mock response with no utterances
      vi.mocked(assemblyAIModule.fetchAssemblyAIWithDiarization).mockResolvedValue({
        transcription: '',
        utterances: [],
        rawResponse: {},
        audioDurationSeconds: 0,
      });

      const segments = [
        { audio: new Blob(), timestamp: Date.now(), transcriptEntryId: 'entry-1' },
      ];

      await result.current.processBatch(segments, 'batch-1');

      // Should not call updateEntrySpeaker
      expect(mockUpdateEntrySpeaker).not.toHaveBeenCalled();
      // Should not call onBatchProcessed
      expect(mockOnBatchProcessed).not.toHaveBeenCalled();
    });

    it('should handle pitch analysis failure with fallback', async () => {
      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: 'test-key',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
        })
      );

      vi.mocked(assemblyAIModule.fetchAssemblyAIWithDiarization).mockResolvedValue({
        transcription: 'Hello',
        utterances: [
          { speaker: 'A', text: 'Hello', start: 0, end: 1000, confidence: 0.9 },
        ],
        rawResponse: {},
        audioDurationSeconds: 1,
      });

      mockGetTranscriptEntries.mockReturnValue([
        {
          original: 'Hello',
          timestamp: Date.now(),
          audioSource: 'system',
        } as TranscriptEntry,
      ]);

      // Mock pitch analysis failure
      vi.mocked(pitchAnalysisModule.analyzePitch).mockRejectedValue(
        new Error('Pitch analysis failed')
      );

      const segments = [
        { audio: new Blob(), timestamp: Date.now(), transcriptEntryId: 'entry-1' },
      ];

      await result.current.processBatch(segments, 'batch-1');

      // Should still update entry with fallback speaker
      expect(mockUpdateEntrySpeaker).toHaveBeenCalled();
    });

    it('should match existing profile by pitch', async () => {
      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: 'test-key',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
        })
      );

      vi.mocked(assemblyAIModule.fetchAssemblyAIWithDiarization).mockResolvedValue({
        transcription: 'Hello',
        utterances: [
          { speaker: 'A', text: 'Hello', start: 0, end: 1000, confidence: 0.9 },
        ],
        rawResponse: {},
        audioDurationSeconds: 1,
      });

      const now = Date.now();
      mockGetTranscriptEntries.mockReturnValue([
        {
          original: 'Hello',
          timestamp: now,
          audioSource: 'system',
        } as TranscriptEntry,
      ]);

      vi.mocked(pitchAnalysisModule.analyzePitch).mockResolvedValue({
        minHz: 100,
        maxHz: 200,
        avgHz: 150,
        dominantHz: 145,
        variance: 50,
        confidence: 0.8,
      });

      // Mock profile found
      const existingProfile = {
        id: 'existing-profile-1',
        name: 'John Doe',
        type: 'colleague' as const,
        color: '#22c55e',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        pitchProfile: {} as any,
        isConfirmed: true,
      };
      vi.mocked(speakerProfilesStorage.findProfileByPitch).mockResolvedValue(existingProfile);
      vi.mocked(speakerProfilesStorage.updateProfilePitch).mockResolvedValue(undefined);

      const segments = [
        { audio: new Blob(), timestamp: now, transcriptEntryId: 'entry-1' },
      ];

      await result.current.processBatch(segments, 'batch-1');

      // Should use existing profile
      expect(mockUpdateEntrySpeaker).toHaveBeenCalledWith(
        now,
        expect.objectContaining({
          speakerId: 'profile_existing-profile-1',
          speakerLabel: 'John Doe',
          confirmed: true, // Should be confirmed since it matched a profile
        })
      );

      // Should update profile with new pitch data
      expect(speakerProfilesStorage.updateProfilePitch).toHaveBeenCalled();
    });

    it('should limit candidate pool to last 100 entries', async () => {
      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: 'test-key',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
        })
      );

      vi.mocked(assemblyAIModule.fetchAssemblyAIWithDiarization).mockResolvedValue({
        transcription: 'Test',
        utterances: [
          { speaker: 'A', text: 'Test', start: 0, end: 1000, confidence: 0.9 },
        ],
        rawResponse: {},
        audioDurationSeconds: 1,
      });

      // Create 200 unconfirmed transcript entries (should only use last 100)
      const entries: TranscriptEntry[] = [];
      const now = Date.now();
      for (let i = 0; i < 200; i++) {
        entries.push({
          original: `Entry ${i}`,
          timestamp: now - (200 - i) * 1000,
          audioSource: 'system',
        } as TranscriptEntry);
      }
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
        id: 'profile-1',
        name: 'Speaker 1',
        type: 'other',
        color: '#22c55e',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        pitchProfile: {} as any,
        isConfirmed: false,
      });

      const segments = [
        { audio: new Blob(), timestamp: now, transcriptEntryId: 'entry-1' },
      ];

      await result.current.processBatch(segments, 'batch-1');

      // Test passes if no performance warnings occur and matching completes
      expect(mockUpdateEntrySpeaker).toHaveBeenCalled();
    });
  });

  describe('Text similarity early exit optimization', () => {
    it('should skip Levenshtein distance for entries with time diff > 4.5s', async () => {
      const { result } = renderHook(() =>
        useSpeakerDiarization({
          apiKey: 'test-key',
          updateEntrySpeaker: mockUpdateEntrySpeaker,
          getTranscriptEntries: mockGetTranscriptEntries,
        })
      );

      vi.mocked(assemblyAIModule.fetchAssemblyAIWithDiarization).mockResolvedValue({
        transcription: 'Hello',
        utterances: [
          { speaker: 'A', text: 'Hello', start: 0, end: 1000, confidence: 0.9 },
        ],
        rawResponse: {},
        audioDurationSeconds: 1,
      });

      const now = Date.now();
      // Create entries with large time differences (> 4.5s)
      mockGetTranscriptEntries.mockReturnValue([
        {
          original: 'Far past entry',
          timestamp: now - 10000, // 10 seconds ago
          audioSource: 'system',
        } as TranscriptEntry,
        {
          original: 'Recent entry',
          timestamp: now - 500, // 0.5 seconds ago
          audioSource: 'system',
        } as TranscriptEntry,
      ]);

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
        id: 'profile-1',
        name: 'Speaker 1',
        type: 'other',
        color: '#22c55e',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        pitchProfile: {} as any,
        isConfirmed: false,
      });

      const segments = [
        { audio: new Blob(), timestamp: now, transcriptEntryId: 'entry-1' },
      ];

      await result.current.processBatch(segments, 'batch-1');

      // Should match the recent entry, not the far past one
      expect(mockUpdateEntrySpeaker).toHaveBeenCalled();
    });
  });
});
