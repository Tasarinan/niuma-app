/**
 * useMeetingChannel - Live meeting transcription for a "meeting" GroupChannel.
 *
 * Composes the same building blocks used by the floating completion widget's
 * Meeting Assist Mode (see pages/app/components/completion/{Audio,AutoSpeechVad}.tsx):
 *  - Microphone capture via VAD → STT → "You" transcript entries.
 *  - System audio capture via useMeetingAudio → STT → "Guest" transcript entries.
 *  - Optional AssemblyAI-based speaker diarization to upgrade "Guest" entries
 *    into distinct, consistently labeled speakers.
 *
 * Unlike useCompletion, this hook keeps the transcript fully local/in-memory
 * for display, but when a meeting ends it also generates an AI summary
 * (topics/decisions/action items/entities) via meeting-summarizer.ts and
 * saves it so it shows up in the /context-memory page.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "@/store";
import { secureGet } from "@/lib";
import {
  summarizeMeetingTranscript,
  shouldSummarizeMeeting,
  type MeetingTranscriptLine,
} from "@/lib/functions/meeting-summarizer";
import { useMeetingAudio, useSpeakerDiarization, useTranslation, useMicVadTranscription } from "@/hooks";
import { STORAGE_KEYS } from "@/config";
import { SpeakerIdFactory, type SpeakerInfo, type TranscriptEntry } from "@/types";

export interface MeetingParticipant {
  speakerId: string;
  label: string;
  source: "microphone" | "system" | "unknown";
  messageCount: number;
  lastActive: number;
}

export function useMeetingChannel(channelId: string) {
  const { selectedAudioDevices, selectedSttProvider, allSttProviders, sttLanguage, sttTranslationEnabled, selectedAIProvider, allAiProviders } =
    useApp();
  const { translate, isEnabled: translationEnabled } = useTranslation();

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [assemblyAIKey, setAssemblyAIKey] = useState("");
  // System audio permission flow (mirrors pages/app/components/speech/{PermissionFlow,SetupInstructions}
  // and useSystemAudio.ts's setupRequired/handleSetup pattern).
  const [permissionRequired, setPermissionRequired] = useState(false);

  useEffect(() => {
    secureGet(STORAGE_KEYS.ASSEMBLYAI_API_KEY)
      .then((key) => setAssemblyAIKey(key || ""))
      .catch(() => setAssemblyAIKey(""));
  }, []);

  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;

  const updateTranscriptTranslation = useCallback(
    (timestamp: number, translation?: string, error?: string) => {
      setTranscript((prev) =>
        prev.map((entry) =>
          entry.timestamp === timestamp ? { ...entry, translation, translationError: error } : entry
        )
      );
    },
    []
  );

  const translateInBackground = useCallback(
    (text: string, timestamp: number) => {
      if (!translationEnabled) return;
      translate(text).then((result) => {
        if (result.success && result.translation) {
          updateTranscriptTranslation(timestamp, result.translation);
        } else if (result.error) {
          updateTranscriptTranslation(timestamp, undefined, result.error);
        }
      });
    },
    [translate, translationEnabled, updateTranscriptTranslation]
  );

  /** Add a transcript entry captured from this device's microphone ("You"). */
  const addMicTranscript = useCallback(
    (text: string, speaker: SpeakerInfo) => {
      if (!text.trim()) return;
      console.log("[MeetingChannel][MIC] transcript:", text);
      const timestamp = Date.now();
      setTranscript((prev) => [...prev, { original: text, timestamp, speaker, audioSource: "microphone" }]);
      translateInBackground(text, timestamp);
    },
    [translateInBackground]
  );

  /** Add a transcript entry captured from system audio (other participants). */
  const addSystemAudioTranscript = useCallback(
    (text: string, timestamp: number) => {
      if (!text.trim()) return;
      console.log("[MeetingChannel][SYSTEM] transcript:", text);
      const entry: TranscriptEntry = {
        original: text,
        timestamp,
        audioSource: "system",
        speaker: {
          speakerId: SpeakerIdFactory.guest(timestamp),
          speakerLabel: "Guest",
          confirmed: false,
        },
      };
      setTranscript((prev) => [...prev, entry]);
      translateInBackground(text, timestamp);
    },
    [translateInBackground]
  );

  const updateEntrySpeaker = useCallback((timestamp: number, speakerInfo: SpeakerInfo) => {
    setTranscript((prev) =>
      prev.map((entry) => (entry.timestamp === timestamp ? { ...entry, speaker: speakerInfo } : entry))
    );
  }, []);

  const assignSpeaker = useCallback((speakerId: string, label: string, profileId?: string) => {
    setTranscript((prev) =>
      prev.map((entry) =>
        entry.speaker?.speakerId === speakerId
          ? { ...entry, speaker: { ...entry.speaker, speakerLabel: label, speakerProfileId: profileId } }
          : entry
      )
    );
  }, []);

  const clearTranscript = useCallback(() => setTranscript([]), []);

  // Phase 3-style speaker diarization for system ("Guest") audio.
  const { createAudioBuffer } = useSpeakerDiarization({
    apiKey: assemblyAIKey,
    language: sttLanguage,
    updateEntrySpeaker,
    getTranscriptEntries: useCallback(() => transcriptRef.current, []),
    onError: (error) => {
      console.error("[MeetingChannel] Diarization error:", error.message);
    },
  });

  const audioBuffer = useMemo(() => {
    if (isRecording && assemblyAIKey) return createAudioBuffer();
    return null;
  }, [isRecording, assemblyAIKey, createAudioBuffer]);

  const sttProviderConfig = allSttProviders.find((p) => p.id === selectedSttProvider.provider);

  // System audio capture (other meeting participants).
  const { isProcessing: isProcessingSystemAudio } = useMeetingAudio({
    enabled: isRecording,
    onSystemAudioTranscript: addSystemAudioTranscript,
    onError: (error) => console.error("[MeetingChannel] System audio error:", error.message),
    sttProvider: sttProviderConfig,
    selectedSttProvider,
    sttLanguage,
    outputDeviceId: selectedAudioDevices.output,
    audioBuffer,
  });

  // Microphone capture ("You") via voice-activity detection.
  const mic = useMicVadTranscription({
    microphoneDeviceId: selectedAudioDevices.input,
    sttLanguage,
    startOnLoad: false,
    onTranscript: (transcription) => {
      console.log("[MeetingChannel][VAD] onTranscript fired:", transcription);
      addMicTranscript(transcription, {
        speakerId: SpeakerIdFactory.you(),
        speakerLabel: "You",
        confirmed: true,
      });
    },
    onError: (error) => {
      console.error("[MeetingChannel] Mic transcription failed:", error);
    },
  });

  useEffect(() => {
    console.log("[MeetingChannel] isRecording changed:", isRecording, "| mic.listening:", mic.listening);
    if (isRecording) {
      mic.start();
    } else {
      mic.pause();
    }
    // Only react to isRecording changes - mic.start/pause are stable callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  // Generate an AI summary (topics/decisions/action items/entities) once a
  // meeting recording stops, and save it so it shows up in /context-memory.
  const wasRecordingRef = useRef(false);
  useEffect(() => {
    if (wasRecordingRef.current && !isRecording) {
      const lines: MeetingTranscriptLine[] = transcriptRef.current
        .filter((entry) => entry.original.trim())
        .map((entry) => ({
          speakerLabel: entry.speaker?.speakerLabel || "Speaker",
          text: entry.original,
        }));

      if (shouldSummarizeMeeting(lines)) {
        setIsSummarizing(true);
        const providerConfig = {
          provider: allAiProviders.find((p) => p.id === selectedAIProvider.provider),
          selectedProvider: selectedAIProvider,
        };
        summarizeMeetingTranscript(channelId, lines, providerConfig)
          .then((success) => {
            if (success) {
              toast.success("会议总结已生成", {
                description: "可在“上下文记忆”页面查看总结与提取的信息",
              });
            }
          })
          .catch((error) => {
            console.error("[MeetingChannel] Summarization failed:", error);
          })
          .finally(() => setIsSummarizing(false));
      }
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording, channelId, allAiProviders, selectedAIProvider]);

  const startMeeting = useCallback(async () => {
    try {
      const hasAccess = await invoke<boolean>("check_system_audio_access");
      if (!hasAccess) {
        setPermissionRequired(true);
        return;
      }
    } catch (error) {
      console.error("[MeetingChannel] Permission check failed:", error);
      setPermissionRequired(true);
      return;
    }
    setPermissionRequired(false);
    setIsRecording(true);
  }, []);
  const stopMeeting = useCallback(() => setIsRecording(false), []);
  const toggleMeeting = useCallback(() => {
    if (isRecording) {
      stopMeeting();
    } else {
      startMeeting();
    }
  }, [isRecording, startMeeting, stopMeeting]);

  // Called once the user grants access via PermissionFlow/SetupInstructions.
  const handlePermissionGranted = useCallback(() => {
    setPermissionRequired(false);
    setIsRecording(true);
  }, []);

  // Called from SetupInstructions' "request access" button - requests OS
  // permission, waits for the user to grant it, then re-checks.
  const handleSetup = useCallback(async () => {
    try {
      const platform = navigator.platform.toLowerCase();
      if (platform.includes("mac") || platform.includes("win")) {
        await invoke("request_system_audio_access");
      }
      // Give the user time to grant permission in the system dialog.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const hasAccess = await invoke<boolean>("check_system_audio_access");
      if (hasAccess) {
        setPermissionRequired(false);
        setIsRecording(true);
      } else {
        setPermissionRequired(true);
      }
    } catch (error) {
      console.error("[MeetingChannel] Permission request failed:", error);
      setPermissionRequired(true);
    }
  }, []);

  const participants: MeetingParticipant[] = useMemo(() => {
    const map = new Map<string, MeetingParticipant>();
    for (const entry of transcript) {
      if (!entry.speaker) continue;
      const id = entry.speaker.speakerId;
      const existing = map.get(id);
      if (existing) {
        existing.messageCount += 1;
        existing.lastActive = entry.timestamp;
        if (entry.speaker.speakerLabel) existing.label = entry.speaker.speakerLabel;
      } else {
        map.set(id, {
          speakerId: id,
          label: entry.speaker.speakerLabel || id,
          source: entry.audioSource ?? "unknown",
          messageCount: 1,
          lastActive: entry.timestamp,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.lastActive - b.lastActive);
  }, [transcript]);

  return {
    isRecording,
    startMeeting,
    stopMeeting,
    toggleMeeting,
    transcript,
    clearTranscript,
    assignSpeaker,
    participants,
    isProcessingSystemAudio,
    isTranscribingMic: mic.isTranscribing,
    isSummarizing,
    micListening: mic.listening,
    micUserSpeaking: mic.userSpeaking,
    sttTranslationEnabled,
    canUseVoice: !!selectedSttProvider.provider,
    permissionRequired,
    handlePermissionGranted,
    handleSetup,
  };
}
