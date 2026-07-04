/**
 * Audio Buffer for Speaker Diarization (Phase 3)
 *
 * This module handles buffering of audio segments for batch diarization.
 * Audio segments are collected over a configurable duration (default 30s),
 * then concatenated and sent for diarization processing.
 */

/**
 * A buffered audio segment with metadata for matching back to transcript entries.
 */
export interface BufferedSegment {
  /** The audio data */
  audio: Blob;
  /** When this segment was captured */
  timestamp: number;
  /** Link to the displayed transcript entry (for retroactive label updates) */
  transcriptEntryId: string;
}

/**
 * DiarizationAudioBuffer class for collecting and batching audio segments.
 * (Named to avoid conflict with Web Audio API's AudioBuffer)
 *
 * Usage:
 * 1. Create buffer with batch duration and callback
 * 2. Call addSegment() for each audio chunk
 * 3. Buffer automatically flushes when batch duration elapses
 * 4. Call forceFlush() when meeting ends to process remaining segments
 */
export class DiarizationAudioBuffer {
  private segments: BufferedSegment[] = [];
  private batchDurationMs: number;
  private onBatchReady: (segments: BufferedSegment[], batchId: string) => void;
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private firstSegmentTime: number | null = null;
  private batchCounter: number = 0;

  constructor(
    batchDurationMs: number = 30000,
    onBatchReady: (segments: BufferedSegment[], batchId: string) => void
  ) {
    this.batchDurationMs = batchDurationMs;
    this.onBatchReady = onBatchReady;
  }

  /**
   * Add an audio segment to the buffer.
   * Starts the batch timer on first segment.
   */
  addSegment(audio: Blob, timestamp: number, entryId: string): void {
    this.segments.push({ audio, timestamp, transcriptEntryId: entryId });

    // Check BOTH firstSegmentTime AND batchTimer to prevent race condition
    // where multiple rapid calls could each start a timer
    if (this.firstSegmentTime === null && this.batchTimer === null) {
      this.firstSegmentTime = timestamp;
      this.startBatchTimer();
    }
  }

  /**
   * Get the number of segments currently buffered.
   */
  getSegmentCount(): number {
    return this.segments.length;
  }

  /**
   * Check if the buffer has any segments.
   */
  hasSegments(): boolean {
    return this.segments.length > 0;
  }

  private startBatchTimer(): void {
    this.batchTimer = setTimeout(() => {
      this.flushBatch();
    }, this.batchDurationMs);
  }

  private flushBatch(): void {
    if (this.segments.length === 0) return;

    const batch = [...this.segments];
    this.segments = [];
    this.firstSegmentTime = null;
    this.batchTimer = null;

    // Include batch ID for cross-batch speaker tracking
    const batchId = `batch_${++this.batchCounter}_${Date.now()}`;
    this.onBatchReady(batch, batchId);
  }

  /**
   * Clear all buffered segments and cancel pending timer.
   */
  clear(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.segments = [];
    this.firstSegmentTime = null;
  }

  /**
   * Force flush remaining segments (e.g., when meeting ends).
   */
  forceFlush(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    this.flushBatch();
  }
}

// Shared AudioContext to avoid memory leaks from creating many contexts
let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContext();
  }
  return sharedAudioContext;
}

/**
 * Concatenate multiple audio blobs into a single WAV blob.
 * Uses a shared AudioContext to prevent memory leaks.
 */
export async function concatenateAudioBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) {
    throw new Error("No audio blobs to concatenate");
  }

  if (blobs.length === 1) {
    return blobs[0]; // No need to concatenate single blob
  }

  // Reuse single AudioContext instead of creating one per blob
  const audioContext = getSharedAudioContext();

  const decodedBuffers = await Promise.all(
    blobs.map(async (blob) => {
      const arrayBuffer = await blob.arrayBuffer();
      // slice(0) creates a copy to avoid detached ArrayBuffer issues
      return audioContext.decodeAudioData(arrayBuffer.slice(0));
    })
  );

  // Calculate total length
  const totalLength = decodedBuffers.reduce(
    (sum, buffer) => sum + buffer.length,
    0
  );
  const sampleRate = decodedBuffers[0]?.sampleRate || 16000;

  // Create combined buffer using OfflineAudioContext
  const offlineContext = new OfflineAudioContext(1, totalLength, sampleRate);
  let offset = 0;

  for (const decoded of decodedBuffers) {
    const source = offlineContext.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineContext.destination);
    source.start(offset / sampleRate);
    offset += decoded.length;
  }

  const renderedBuffer = await offlineContext.startRendering();

  // Convert to WAV blob
  return audioBufferToWavBlob(renderedBuffer);
}

/**
 * Convert an AudioBuffer to a WAV Blob.
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const samples = buffer.getChannelData(0);
  const dataLength = samples.length * bytesPerSample;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // WAV header helper
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF header
  writeString(0, "RIFF");
  view.setUint32(4, totalLength - 8, true);
  writeString(8, "WAVE");

  // fmt subchunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // subchunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data subchunk
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  // Write audio samples
  let writeOffset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      writeOffset,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true
    );
    writeOffset += 2;
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}
