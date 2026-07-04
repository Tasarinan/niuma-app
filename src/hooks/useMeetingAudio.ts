/**
 * useMeetingAudio - Hook for capturing system audio in Meeting Assist Mode
 *
 * This hook manages system audio capture specifically for meeting scenarios,
 * where we want to transcribe audio from calls/meetings (other participants)
 * separately from microphone audio (the user).
 *
 * Phase 3 Enhancement: Supports audio buffering for speaker diarization.
 * When an AudioBuffer is provided, audio segments are added to the buffer
 * for batch diarization processing (retroactive speaker labeling).
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { fetchSTT } from '@/lib';
import type { TYPE_PROVIDER } from '@/types';
import type { DiarizationAudioBuffer } from '@/lib/functions/audio-buffer';

interface SelectedProvider {
  provider: string;
  variables: Record<string, string>;
}

interface UseMeetingAudioProps {
  /** Whether system audio capture is enabled */
  enabled: boolean;
  /** Callback when system audio is transcribed - returns the entry ID for buffering */
  onSystemAudioTranscript: (text: string, timestamp: number) => void;
  /** Optional callback for errors (shown to user) */
  onError?: (error: Error) => void;
  /** STT provider configuration */
  sttProvider?: TYPE_PROVIDER;
  /** Selected STT provider info */
  selectedSttProvider: SelectedProvider;
  /** Language for STT */
  sttLanguage: string;
  /** Output device ID (optional, uses default if not specified) */
  outputDeviceId?: string;
  /** Optional audio buffer for diarization (Phase 3) */
  audioBuffer?: DiarizationAudioBuffer | null;
}

// VAD configuration optimized for meeting audio
const MEETING_VAD_CONFIG = {
  enabled: true,
  hop_size: 1024,
  sensitivity_rms: 0.012,
  peak_threshold: 0.035,
  silence_chunks: 45,
  min_speech_chunks: 7,
  pre_speech_chunks: 12,
  noise_gate_threshold: 0.003,
  max_recording_duration_secs: 180,
};

// Maximum queue size to prevent unbounded memory growth when STT is slower than audio capture
// At ~50-200KB per segment, 50 segments = 2.5-10MB max memory usage (reasonable buffer)
const MAX_QUEUE_SIZE = 50;

export function useMeetingAudio({
  enabled,
  onSystemAudioTranscript,
  onError,
  sttProvider,
  selectedSttProvider,
  sttLanguage,
  outputDeviceId,
  audioBuffer,
}: UseMeetingAudioProps) {
  // Queue-based processing to avoid dropping speech segments
  const processingQueueRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasQueuedAudio, setHasQueuedAudio] = useState(false);
  const isSetupCompleteRef = useRef(false);
  const enabledRef = useRef(enabled);
  const audioBufferRef = useRef(audioBuffer);
  const onSystemAudioTranscriptRef = useRef(onSystemAudioTranscript);
  const onErrorRef = useRef(onError);
  const droppedCountRef = useRef(0);

  // Keep refs in sync
  useEffect(() => {
    enabledRef.current = enabled;
    audioBufferRef.current = audioBuffer;
    onSystemAudioTranscriptRef.current = onSystemAudioTranscript;
    onErrorRef.current = onError;
  }, [enabled, audioBuffer, onSystemAudioTranscript, onError]);

  // Track processQueue changes
  const processQueueCountRef = useRef(0);

  // Process queue of audio segments
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || processingQueueRef.current.length === 0) {
      setHasQueuedAudio(false);
      return;
    }
    isProcessingRef.current = true;
    setIsProcessing(true);

    while (processingQueueRef.current.length > 0) {
      // Check if still enabled before processing each item
      if (!enabledRef.current) {
        const discardedCount = processingQueueRef.current.length;
        if (discardedCount > 0) {
          console.warn(`[MeetingAudio] Meeting mode disabled. Discarding ${discardedCount} queued audio segment(s)`);
          // Notify user about discarded segments
          onErrorRef.current?.(new Error(`Meeting mode stopped. ${discardedCount} audio segment${discardedCount > 1 ? 's were' : ' was'} not transcribed.`));
        }
        processingQueueRef.current = [];
        setHasQueuedAudio(false);
        break;
      }

      const base64Audio = processingQueueRef.current.shift()!;

      // Update queue state
      setHasQueuedAudio(processingQueueRef.current.length > 0);

      try {
        // Convert base64 to blob
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const audioBlob = new Blob([bytes], { type: 'audio/wav' });

        // Transcribe
        const transcription = await fetchSTT({
          provider: sttProvider,
          selectedProvider: selectedSttProvider,
          audio: audioBlob,
          language: sttLanguage,
        });

        if (transcription?.trim() && enabledRef.current) {
          // Use timestamp as entry ID (matches TranscriptEntry.timestamp)
          const timestamp = Date.now();

          // Add to transcript (displayed immediately as "Guest")
          onSystemAudioTranscriptRef.current(transcription, timestamp);

          // Phase 3: Buffer audio for diarization if buffer is provided
          // The buffer will batch segments and trigger diarization after 30 seconds
          // Diarization will then update "Guest" labels to "Speaker 1", "Speaker 2", etc.
          if (audioBufferRef.current) {
            const entryId = `guest_${timestamp}`; // Matches speakerId format in addSystemAudioTranscript
            audioBufferRef.current.addSegment(audioBlob, timestamp, entryId);
          }
        }
      } catch (err) {
        console.error('[MeetingAudio] STT failed:', err);
        // Don't call onError for individual STT failures - just log
        // This prevents flooding the user with errors during transient issues
      }
    }

    isProcessingRef.current = false;
    setIsProcessing(false);
  }, [sttProvider, selectedSttProvider, sttLanguage]);

  // Log when processQueue changes
  useEffect(() => {
    processQueueCountRef.current++;
    console.log('[MeetingAudio] processQueue recreated, count:', processQueueCountRef.current);
  }, [processQueue]);

  useEffect(() => {
    console.log('[MeetingAudio] useEffect running. enabled:', enabled, 'processQueue:', processQueue.name, 'outputDeviceId:', outputDeviceId);

    if (!enabled) {
      console.log('[MeetingAudio] Disabled, skipping setup');
      return;
    }

    let unlistenSpeechDetected: (() => void) | undefined;
    let unlistenSpeechStart: (() => void) | undefined;
    isSetupCompleteRef.current = false;

    const setup = async () => {
      try {
        // Start system audio capture
        const deviceId = outputDeviceId && outputDeviceId !== 'default'
          ? outputDeviceId
          : null;

        await invoke('start_system_audio_capture', {
          vadConfig: MEETING_VAD_CONFIG,
          deviceId,
        });

        console.log('[MeetingAudio] System audio capture started');
      } catch (err) {
        console.error('[MeetingAudio] Failed to start system audio:', err);
        onErrorRef.current?.(new Error('Failed to capture system audio. Check audio permissions.'));
        return;
      }

      try {
        // Listen for speech START events (fires when guest starts speaking)
        unlistenSpeechStart = await listen('speech-start', () => {
          if (!enabledRef.current) return;
          console.log('[MeetingAudio] Guest started speaking');
          setHasQueuedAudio(true); // Show indicator immediately when guest starts speaking
        });

        // Listen for speech detected events (fires when speech ends)
        unlistenSpeechDetected = await listen('speech-detected', async (event) => {
          if (!enabledRef.current) return;

          const base64Audio = event.payload as string;

          // Prevent unbounded queue growth when STT is slower than audio capture
          if (processingQueueRef.current.length >= MAX_QUEUE_SIZE) {
            processingQueueRef.current.shift(); // Drop oldest segment
            droppedCountRef.current++;
            console.warn('[MeetingAudio] Queue full, dropping oldest segment');

            // Notify user after significant drops (actionable threshold)
            if (droppedCountRef.current === 10) {
              onErrorRef.current?.(new Error(
                'Meeting audio backlog detected. Consider using a faster STT provider.'
              ));
            }
          }

          // Queue instead of dropping
          processingQueueRef.current.push(base64Audio);
          processQueue();
        });

        isSetupCompleteRef.current = true;
        console.log('[MeetingAudio] Event listener setup complete');
      } catch (err) {
        console.error('[MeetingAudio] Failed to setup event listener:', err);
        onErrorRef.current?.(new Error('Failed to setup audio event listener.'));
        // Try to clean up the capture we started
        invoke('stop_system_audio_capture').catch(() => {});
      }
    };

    setup();

    return () => {
      console.log('[MeetingAudio] Cleaning up...');

      // Always attempt cleanup to prevent race conditions during async setup
      // All operations below are safe to call regardless of setup completion state:
      // - Event listener cleanup has null checks
      // - stop_system_audio_capture has error handling (idempotent if not started)
      // - Ref/state cleanup is always safe

      // Cleanup event listeners (safe even if undefined)
      if (unlistenSpeechStart) {
        unlistenSpeechStart();
      }
      if (unlistenSpeechDetected) {
        unlistenSpeechDetected();
      }

      // Stop system audio capture (idempotent, handles "not started" gracefully)
      invoke('stop_system_audio_capture').catch((err) => {
        console.error('[MeetingAudio] Failed to stop capture:', err);
      });

      // Phase 3: Force flush any remaining buffered audio for diarization
      // then clear the buffer (meeting ended)
      if (audioBufferRef.current) {
        audioBufferRef.current.forceFlush();
        audioBufferRef.current.clear();
      }

      // Clear queue on cleanup (log if discarding segments)
      const queueLength = processingQueueRef.current.length;
      if (queueLength > 0) {
        console.log(`[MeetingAudio] Cleanup: Discarding ${queueLength} queued segment(s)`);
      }
      processingQueueRef.current = [];
      isProcessingRef.current = false;
      setIsProcessing(false);
      setHasQueuedAudio(false);
      isSetupCompleteRef.current = false;
      droppedCountRef.current = 0; // Reset for next session
    };
  }, [enabled, processQueue, outputDeviceId]);

  return {
    /** Whether guest audio is being captured or processed (true while speaking OR transcribing) */
    isProcessing: isProcessing || hasQueuedAudio,
  };
}
