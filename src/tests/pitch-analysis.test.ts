import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  PitchProfile,
  PitchAnalysisResult,
} from '@/lib/functions/pitch-analysis';

describe('pitch-analysis', () => {
  let originalAudioContext: any;
  let originalWindowAudioContext: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset modules to clear the shared AudioContext cache
    await vi.resetModules();
    // Save original AudioContext constructors
    originalAudioContext = global.AudioContext;
    originalWindowAudioContext = (global.window as any).AudioContext;
  });

  afterEach(() => {
    // Close any existing audio context to force getSharedAudioContext to create a new one
    // This prevents tests from reusing a cached AudioContext instance
    if ((global.window as any).AudioContext) {
      try {
        const ctx = new (global.window as any).AudioContext();
        if (ctx.close) {
          ctx.close();
        }
      } catch (e) {
        // Ignore errors
      }
    }

    // Restore original AudioContext constructors
    global.AudioContext = originalAudioContext;
    (global.window as any).AudioContext = originalWindowAudioContext;
  });

  describe('analyzePitch', () => {
    it('should reject audio with 0-length samples', async () => {
      // Create empty audio blob
      const emptyAudio = new Blob([], { type: 'audio/wav' });

      // Mock AudioContext.decodeAudioData to return empty buffer
      global.AudioContext = function (this: any) {
        this.decodeAudioData = vi.fn().mockImplementation(() => Promise.resolve({
          getChannelData: () => new Float32Array(0), // 0 samples
          numberOfChannels: 1,
          length: 0,
          sampleRate: 44100,
          duration: 0,
        }));
        this.state = 'running';
        this.close = vi.fn().mockImplementation(() => { this.state = 'closed'; });
      } as any;
      (global.window as any).AudioContext = global.AudioContext;

      // Dynamically import to use the new mock
      const { analyzePitch } = await import('@/lib/functions/pitch-analysis');

      await expect(analyzePitch(emptyAudio)).rejects.toThrow(
        /Pitch analysis failed:.*Audio too short for pitch analysis/
      );
    });

    it('should reject audio shorter than windowSize (2048 samples)', async () => {
      // Create audio with only 1000 samples (less than 2048 required)
      const shortSamples = new Float32Array(1000);

      global.AudioContext = function (this: any) {
        this.decodeAudioData = vi.fn().mockImplementation(() => Promise.resolve({
          getChannelData: () => shortSamples,
          numberOfChannels: 1,
          length: shortSamples.length,
          sampleRate: 44100,
          duration: shortSamples.length / 44100,
        }));
        this.state = 'running';
        this.close = vi.fn().mockImplementation(() => { this.state = 'closed'; });
      } as any;
      (global.window as any).AudioContext = global.AudioContext;

      const shortAudio = new Blob([new ArrayBuffer(1000)], { type: 'audio/wav' });

      // Dynamically import to use the new mock
      const { analyzePitch } = await import('@/lib/functions/pitch-analysis');

      await expect(analyzePitch(shortAudio)).rejects.toThrow(
        /Pitch analysis failed:.*Audio too short for pitch analysis: 1000 samples \(minimum 2048 required\)/
      );
    });

    it('should reject audio with insufficient valid pitch samples', async () => {
      // Create audio that will produce < 3 valid pitch samples
      // Use samples that won't match human voice range (50-500 Hz)
      const samples = new Float32Array(3000);
      // Fill with noise that won't produce valid pitch
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.random() * 0.001; // Very low amplitude noise
      }

      global.AudioContext = function (this: any) {
        this.decodeAudioData = vi.fn().mockImplementation(() => Promise.resolve({
          getChannelData: () => samples,
          numberOfChannels: 1,
          length: samples.length,
          sampleRate: 44100,
          duration: samples.length / 44100,
        }));
        this.state = 'running';
        this.close = vi.fn().mockImplementation(() => { this.state = 'closed'; });
      } as any;
      (global.window as any).AudioContext = global.AudioContext;

      // Dynamically import to use the new mock
      const { analyzePitch } = await import('@/lib/functions/pitch-analysis');

      const noisyAudio = new Blob([new ArrayBuffer(3000)], { type: 'audio/wav' });

      await expect(analyzePitch(noisyAudio)).rejects.toThrow(
        /Pitch analysis failed:.*Insufficient valid pitch detected in audio/
      );
    });

    it('should successfully analyze audio with valid pitch data', async () => {
      // Create a synthetic sine wave at 150 Hz (typical male voice)
      const sampleRate = 44100;
      const duration = 0.5; // 0.5 seconds
      const frequency = 150; // Hz
      const numSamples = Math.floor(sampleRate * duration);
      const samples = new Float32Array(numSamples);

      for (let i = 0; i < numSamples; i++) {
        samples[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
      }

      global.AudioContext = function (this: any) {
        this.decodeAudioData = vi.fn().mockImplementation(() => Promise.resolve({
          getChannelData: () => samples,
          numberOfChannels: 1,
          length: samples.length,
          sampleRate,
          duration: samples.length / sampleRate,
        }));
        this.state = 'running';
        this.close = vi.fn().mockImplementation(() => { this.state = 'closed'; });
      } as any;
      (global.window as any).AudioContext = global.AudioContext;

      // Dynamically import to use the new mock
      const { analyzePitch } = await import('@/lib/functions/pitch-analysis');

      const validAudio = new Blob([new ArrayBuffer(numSamples * 4)], { type: 'audio/wav' });

      const result = await analyzePitch(validAudio);

      // Verify structure
      expect(result).toHaveProperty('minHz');
      expect(result).toHaveProperty('maxHz');
      expect(result).toHaveProperty('avgHz');
      expect(result).toHaveProperty('dominantHz');
      expect(result).toHaveProperty('variance');
      expect(result).toHaveProperty('confidence');

      // Verify values are in reasonable ranges
      expect(result.minHz).toBeGreaterThanOrEqual(50);
      expect(result.maxHz).toBeLessThanOrEqual(500);
      expect(result.avgHz).toBeGreaterThanOrEqual(50);
      expect(result.avgHz).toBeLessThanOrEqual(500);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle audio decoding errors gracefully', async () => {
      global.AudioContext = function (this: any) {
        this.decodeAudioData = vi.fn().mockRejectedValue(new Error('Decode failed'));
        this.state = 'running';
        this.close = vi.fn().mockImplementation(() => { this.state = 'closed'; });
      } as any;
      (global.window as any).AudioContext = global.AudioContext;

      // Dynamically import to use the new mock
      const { analyzePitch } = await import('@/lib/functions/pitch-analysis');

      const invalidAudio = new Blob([new ArrayBuffer(1000)], { type: 'audio/wav' });

      await expect(analyzePitch(invalidAudio)).rejects.toThrow(
        /Pitch analysis failed/
      );
    });
  });

  describe('comparePitchProfiles', () => {
    it('should return 100 for identical profiles', async () => {
      const { comparePitchProfiles } = await import('@/lib/functions/pitch-analysis');

      const profile1 = { minHz: 100, maxHz: 200, avgHz: 150 };
      const profile2 = { minHz: 100, maxHz: 200, avgHz: 150 };

      const similarity = comparePitchProfiles(profile1, profile2);

      expect(similarity).toBe(100);
    });

    it('should return low similarity for very different profiles', async () => {
      const { comparePitchProfiles } = await import('@/lib/functions/pitch-analysis');

      // Male voice (low pitch)
      const maleProfile = { minHz: 85, maxHz: 180, avgHz: 120 };
      // Female voice (high pitch)
      const femaleProfile = { minHz: 165, maxHz: 255, avgHz: 210 };

      const similarity = comparePitchProfiles(maleProfile, femaleProfile);

      // Should be low similarity (< 50)
      expect(similarity).toBeLessThan(50);
    });

    it('should return high similarity for similar profiles', async () => {
      const { comparePitchProfiles } = await import('@/lib/functions/pitch-analysis');

      const profile1 = { minHz: 120, maxHz: 200, avgHz: 160 };
      const profile2 = { minHz: 115, maxHz: 205, avgHz: 155 };

      const similarity = comparePitchProfiles(profile1, profile2);

      // Should be high similarity (> 70)
      expect(similarity).toBeGreaterThan(70);
    });

    it('should handle edge case with zero range', async () => {
      const { comparePitchProfiles } = await import('@/lib/functions/pitch-analysis');

      const profile1 = { minHz: 150, maxHz: 150, avgHz: 150 };
      const profile2 = { minHz: 150, maxHz: 150, avgHz: 150 };

      const similarity = comparePitchProfiles(profile1, profile2);

      // Should handle gracefully
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(100);
    });
  });

  describe('mergePitchProfiles', () => {
    it('should merge new data into existing profile', async () => {
      const { mergePitchProfiles } = await import('@/lib/functions/pitch-analysis');

      const existingProfile: PitchProfile = {
        minHz: 100,
        maxHz: 200,
        avgHz: 150,
        dominantHz: 145,
        variance: 100,
        sampleCount: 5,
        lastUpdated: Date.now() - 1000,
        confidence: 0.8,
      };

      const newData: PitchAnalysisResult = {
        minHz: 90,
        maxHz: 210,
        avgHz: 155,
        dominantHz: 150,
        variance: 90,
        confidence: 0.85,
      };

      const merged = mergePitchProfiles(existingProfile, newData);

      // Min should be minimum of both
      expect(merged.minHz).toBe(90);
      // Max should be maximum of both
      expect(merged.maxHz).toBe(210);
      // Sample count should increment
      expect(merged.sampleCount).toBe(6);
      // Avg should be weighted average
      expect(merged.avgHz).toBeGreaterThan(150);
      expect(merged.avgHz).toBeLessThan(155);
      // Last updated should be recent
      expect(merged.lastUpdated).toBeGreaterThan(existingProfile.lastUpdated);
    });

    it('should weight existing data more heavily with more samples', async () => {
      const { mergePitchProfiles } = await import('@/lib/functions/pitch-analysis');

      const existingProfile: PitchProfile = {
        minHz: 100,
        maxHz: 200,
        avgHz: 150,
        dominantHz: 145,
        variance: 100,
        sampleCount: 100, // Many samples
        lastUpdated: Date.now(),
        confidence: 0.8,
      };

      const newData: PitchAnalysisResult = {
        minHz: 120,
        maxHz: 180,
        avgHz: 200, // Very different
        dominantHz: 195,
        variance: 50,
        confidence: 0.7,
      };

      const merged = mergePitchProfiles(existingProfile, newData);

      // Average should be much closer to existing (150) than new (200)
      expect(merged.avgHz).toBeLessThan(155);
      expect(merged.avgHz).toBeGreaterThan(150);
    });
  });

  describe('createPitchProfile', () => {
    it('should create profile from analysis result', async () => {
      const { createPitchProfile } = await import('@/lib/functions/pitch-analysis');

      const analysisResult: PitchAnalysisResult = {
        minHz: 100,
        maxHz: 200,
        avgHz: 150,
        dominantHz: 145,
        variance: 100,
        confidence: 0.8,
      };

      const profile = createPitchProfile(analysisResult);

      expect(profile.minHz).toBe(100);
      expect(profile.maxHz).toBe(200);
      expect(profile.avgHz).toBe(150);
      expect(profile.dominantHz).toBe(145);
      expect(profile.variance).toBe(100);
      expect(profile.confidence).toBe(0.8);
      expect(profile.sampleCount).toBe(1);
      expect(profile.lastUpdated).toBeGreaterThan(Date.now() - 1000);
    });
  });

  describe('isGoodQuality', () => {
    it('should return true for confidence >= 0.6', async () => {
      const { isGoodQuality } = await import('@/lib/functions/pitch-analysis');

      expect(isGoodQuality({ confidence: 0.6 } as PitchAnalysisResult)).toBe(true);
      expect(isGoodQuality({ confidence: 0.8 } as PitchAnalysisResult)).toBe(true);
      expect(isGoodQuality({ confidence: 1.0 } as PitchAnalysisResult)).toBe(true);
    });

    it('should return false for confidence < 0.6', async () => {
      const { isGoodQuality } = await import('@/lib/functions/pitch-analysis');

      expect(isGoodQuality({ confidence: 0.5 } as PitchAnalysisResult)).toBe(false);
      expect(isGoodQuality({ confidence: 0.3 } as PitchAnalysisResult)).toBe(false);
      expect(isGoodQuality({ confidence: 0.0 } as PitchAnalysisResult)).toBe(false);
    });
  });

  describe('getQualityDescription', () => {
    it('should return "Excellent" for confidence >= 0.8', async () => {
      const { getQualityDescription } = await import('@/lib/functions/pitch-analysis');

      expect(getQualityDescription(0.8)).toBe('Excellent');
      expect(getQualityDescription(0.9)).toBe('Excellent');
      expect(getQualityDescription(1.0)).toBe('Excellent');
    });

    it('should return "Good" for confidence >= 0.6 and < 0.8', async () => {
      const { getQualityDescription } = await import('@/lib/functions/pitch-analysis');

      expect(getQualityDescription(0.6)).toBe('Good');
      expect(getQualityDescription(0.7)).toBe('Good');
      expect(getQualityDescription(0.79)).toBe('Good');
    });

    it('should return "Fair" for confidence >= 0.4 and < 0.6', async () => {
      const { getQualityDescription } = await import('@/lib/functions/pitch-analysis');

      expect(getQualityDescription(0.4)).toBe('Fair');
      expect(getQualityDescription(0.5)).toBe('Fair');
      expect(getQualityDescription(0.59)).toBe('Fair');
    });

    it('should return "Poor" for confidence < 0.4', async () => {
      const { getQualityDescription } = await import('@/lib/functions/pitch-analysis');

      expect(getQualityDescription(0.3)).toBe('Poor');
      expect(getQualityDescription(0.1)).toBe('Poor');
      expect(getQualityDescription(0.0)).toBe('Poor');
    });
  });
});
