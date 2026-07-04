/**
 * Pitch Analysis for Speaker Recognition
 *
 * This module provides pitch detection and analysis capabilities for identifying
 * speakers based on their voice characteristics. Uses Web Audio API and
 * autocorrelation algorithm for fundamental frequency detection.
 */

/**
 * Pitch profile representing a speaker's voice characteristics.
 */
export interface PitchProfile {
  minHz: number;           // Lowest pitch observed
  maxHz: number;           // Highest pitch observed
  avgHz: number;           // Average pitch
  dominantHz: number;      // Most common frequency
  variance: number;        // Pitch stability (lower = more stable)
  sampleCount: number;     // Number of samples analyzed
  lastUpdated: number;     // Timestamp of last update
  confidence: number;      // Quality of analysis (0-1)
}

/**
 * Result of analyzing pitch from an audio sample.
 */
export interface PitchAnalysisResult {
  minHz: number;
  maxHz: number;
  avgHz: number;
  dominantHz: number;
  variance: number;
  confidence: number;
}

// Human voice frequency range
const MIN_HUMAN_VOICE_HZ = 50;
const MAX_HUMAN_VOICE_HZ = 500;

// Reusable AudioContext to avoid memory leaks
let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedAudioContext;
}

/**
 * Analyze pitch characteristics from an audio blob.
 *
 * @param audioBlob - Audio data to analyze (typically WAV format)
 * @returns Pitch analysis result with frequency statistics
 * @throws Error if no valid pitch detected or audio decoding fails
 */
export async function analyzePitch(audioBlob: Blob): Promise<PitchAnalysisResult> {
  try {
    // Decode audio
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = getSharedAudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0)); // slice to avoid detached buffer

    // Get samples (use first channel for mono or left channel for stereo)
    const samples = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Analyze pitch at multiple points throughout the audio
    const windowSize = 2048;
    const hopSize = 512;
    const pitchSamples: number[] = [];

    // Critical: Validate audio has enough samples for analysis
    // Without this check, audio shorter than windowSize would silently produce
    // zero pitch samples, leading to confusing "Insufficient valid pitch" errors.
    if (samples.length < windowSize) {
      throw new Error(
        `Audio too short for pitch analysis: ${samples.length} samples (minimum ${windowSize} required). ` +
        `Duration: ${(samples.length / sampleRate).toFixed(2)}s`
      );
    }

    for (let i = 0; i < samples.length - windowSize; i += hopSize) {
      const window = new Float32Array(samples.slice(i, i + windowSize));
      const pitch = detectPitch(window, sampleRate);

      // Filter to valid human voice range
      if (pitch >= MIN_HUMAN_VOICE_HZ && pitch <= MAX_HUMAN_VOICE_HZ) {
        pitchSamples.push(pitch);
      }
    }

    // Validate we detected enough pitch samples
    if (pitchSamples.length < 3) {
      throw new Error('Insufficient valid pitch detected in audio');
    }

    // Statistical analysis
    pitchSamples.sort((a, b) => a - b);

    const minHz = pitchSamples[0];
    const maxHz = pitchSamples[pitchSamples.length - 1];
    const avgHz = pitchSamples.reduce((sum, val) => sum + val, 0) / pitchSamples.length;
    const dominantHz = findDominantFrequency(pitchSamples);
    const variance = calculateVariance(pitchSamples, avgHz);
    const confidence = calculateConfidence(pitchSamples.length, variance);

    return {
      minHz,
      maxHz,
      avgHz,
      dominantHz,
      variance,
      confidence,
    };
  } catch (error) {
    console.error('[PitchAnalysis] Failed to analyze pitch:', error);
    throw new Error(`Pitch analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Detect fundamental frequency (pitch) using autocorrelation algorithm.
 *
 * @param samples - Audio samples to analyze
 * @param sampleRate - Sample rate of the audio
 * @returns Detected pitch in Hz
 */
function detectPitch(samples: Float32Array, sampleRate: number): number {
  const correlations: number[] = [];
  const minPeriod = Math.floor(sampleRate / MAX_HUMAN_VOICE_HZ); // Max Hz = min period
  const maxPeriod = Math.floor(sampleRate / MIN_HUMAN_VOICE_HZ);   // Min Hz = max period

  // Calculate autocorrelation for each period
  for (let period = minPeriod; period < maxPeriod; period++) {
    let sum = 0;
    for (let i = 0; i < samples.length - period; i++) {
      sum += samples[i] * samples[i + period];
    }
    correlations.push(sum);
  }

  // Find peak correlation (strongest repeating pattern)
  const maxCorrelation = Math.max(...correlations);
  const peakIndex = correlations.indexOf(maxCorrelation);
  const period = minPeriod + peakIndex;

  return sampleRate / period;
}

/**
 * Find the most frequently occurring pitch (mode).
 */
function findDominantFrequency(pitchSamples: number[]): number {
  // Group into 5Hz bins for tolerance
  const binSize = 5;
  const bins = new Map<number, number>();

  for (const pitch of pitchSamples) {
    const bin = Math.round(pitch / binSize) * binSize;
    bins.set(bin, (bins.get(bin) || 0) + 1);
  }

  // Find bin with most samples
  let maxCount = 0;
  let dominantBin = 0;

  for (const [bin, count] of bins.entries()) {
    if (count > maxCount) {
      maxCount = count;
      dominantBin = bin;
    }
  }

  return dominantBin;
}

/**
 * Calculate variance (pitch stability measure).
 */
function calculateVariance(samples: number[], mean: number): number {
  const squaredDiffs = samples.map(val => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / samples.length;
}

/**
 * Calculate confidence based on sample count and stability.
 * More samples and lower variance = higher confidence.
 */
function calculateConfidence(sampleCount: number, variance: number): number {
  // Confidence from sample count (0.5 at 10 samples, 1.0 at 50+ samples)
  const sampleConfidence = Math.min(1.0, sampleCount / 50);

  // Confidence from stability (1.0 at variance < 100, decreases with higher variance)
  const stabilityConfidence = Math.max(0, 1.0 - (variance / 1000));

  // Combined (weighted average)
  return (sampleConfidence * 0.7) + (stabilityConfidence * 0.3);
}

/**
 * Compare two pitch profiles and return similarity score (0-100).
 *
 * @param profile1 - First pitch profile
 * @param profile2 - Second pitch profile
 * @returns Similarity percentage (0-100)
 */
export function comparePitchProfiles(
  profile1: Pick<PitchProfile, 'minHz' | 'maxHz' | 'avgHz'>,
  profile2: Pick<PitchProfile, 'minHz' | 'maxHz' | 'avgHz'>
): number {
  // Calculate range overlap
  const range1 = profile1.maxHz - profile1.minHz;
  const range2 = profile2.maxHz - profile2.minHz;

  const overlapStart = Math.max(profile1.minHz, profile2.minHz);
  const overlapEnd = Math.min(profile1.maxHz, profile2.maxHz);
  const overlap = Math.max(0, overlapEnd - overlapStart);

  const avgRange = (range1 + range2) / 2;
  const overlapPercent = avgRange > 0 ? (overlap / avgRange) * 100 : 0;

  // Calculate average pitch similarity
  const avgDiff = Math.abs(profile1.avgHz - profile2.avgHz);
  const avgSimilarity = Math.max(0, 100 - (avgDiff / 50) * 100); // 50Hz tolerance

  // Weighted combination (overlap is more important for distinguishing speakers)
  const similarity = (overlapPercent * 0.6) + (avgSimilarity * 0.4);

  return Math.min(100, Math.max(0, similarity));
}

/**
 * Merge two pitch profiles (when learning from new data).
 * Updates the target profile with data from the new sample.
 *
 * @param existingProfile - Profile to update
 * @param newData - New pitch analysis result
 * @returns Updated profile
 */
export function mergePitchProfiles(
  existingProfile: PitchProfile,
  newData: PitchAnalysisResult
): PitchProfile {
  const totalSamples = existingProfile.sampleCount + 1;

  // Weighted average (existing data has more weight as sample count increases)
  const existingWeight = existingProfile.sampleCount / totalSamples;
  const newWeight = 1 / totalSamples;

  return {
    minHz: Math.min(existingProfile.minHz, newData.minHz),
    maxHz: Math.max(existingProfile.maxHz, newData.maxHz),
    avgHz: (existingProfile.avgHz * existingWeight) + (newData.avgHz * newWeight),
    dominantHz: (existingProfile.dominantHz * existingWeight) + (newData.dominantHz * newWeight),
    variance: (existingProfile.variance * existingWeight) + (newData.variance * newWeight),
    sampleCount: totalSamples,
    lastUpdated: Date.now(),
    confidence: Math.min(1.0, (existingProfile.confidence + newData.confidence) / 2),
  };
}

/**
 * Create initial pitch profile from analysis result.
 */
export function createPitchProfile(data: PitchAnalysisResult): PitchProfile {
  return {
    ...data,
    sampleCount: 1,
    lastUpdated: Date.now(),
  };
}

/**
 * Check if pitch analysis result indicates good quality audio.
 * Used for showing quality indicators to user.
 */
export function isGoodQuality(result: PitchAnalysisResult): boolean {
  return result.confidence >= 0.6;
}

/**
 * Get quality description for UI display.
 */
export function getQualityDescription(confidence: number): string {
  if (confidence >= 0.8) return 'Excellent';
  if (confidence >= 0.6) return 'Good';
  if (confidence >= 0.4) return 'Fair';
  return 'Poor';
}
