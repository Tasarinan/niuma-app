import { useMicVAD } from "@ricky0123/vad-react";
import { useMemo, useState } from "react";
import { fetchSTT } from "@/lib";
import { floatArrayToWav } from "@/lib/utils";
import { shouldUseNiumaAPI } from "@/lib/functions/Niuma.api";
import { useApp } from "@/store";

export interface UseMicVadTranscriptionOptions {
  /** Specific input device to capture from, or falsy for the system default. */
  microphoneDeviceId?: string;
  /** BCP-47 language hint passed through to the STT provider. */
  sttLanguage?: string;
  /** Whether VAD should start listening as soon as the hook mounts. Defaults to false. */
  startOnLoad?: boolean;
  /** Called with the transcribed text once STT completes for a speech segment. */
  onTranscript: (text: string) => void;
  /** Called when provider validation or transcription fails. */
  onError?: (error: unknown) => void;
}

export interface UseMicVadTranscriptionResult {
  listening: boolean;
  userSpeaking: boolean;
  isTranscribing: boolean;
  start: () => void;
  pause: () => void;
}

/**
 * Shared microphone capture pipeline: voice-activity detection → WAV encode →
 * speech-to-text. This is the common core previously duplicated between the
 * floating completion widget's auto-speech VAD and the Meeting Channel's
 * microphone capture - callers only need to supply what happens with the
 * resulting transcript text (auto-submit to chat, append to a transcript, etc).
 */
export function useMicVadTranscription({
  microphoneDeviceId,
  sttLanguage = "en",
  startOnLoad = false,
  onTranscript,
  onError,
}: UseMicVadTranscriptionOptions): UseMicVadTranscriptionResult {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const { selectedSttProvider, allSttProviders } = useApp();

  const additionalAudioConstraints = useMemo<MediaTrackConstraints>(
    () =>
      microphoneDeviceId
        ? { deviceId: { exact: microphoneDeviceId } }
        : { deviceId: "default" },
    [microphoneDeviceId]
  );

  const vad = useMicVAD({
    userSpeakingThreshold: 0.6,
    startOnLoad,
    additionalAudioConstraints,
    onSpeechEnd: async (audio) => {
      try {
        const useNiumaAPI = await shouldUseNiumaAPI();

        if (!selectedSttProvider.provider && !useNiumaAPI) {
          onError?.(new Error("No speech provider selected. Please select one in settings."));
          return;
        }

        const providerConfig = allSttProviders.find((p) => p.id === selectedSttProvider.provider);

        if (!providerConfig && !useNiumaAPI) {
          onError?.(new Error("Speech provider configuration not found. Please check your settings."));
          return;
        }

        setIsTranscribing(true);
        const audioBlob = floatArrayToWav(audio, 16000, "wav");
        const transcription = await fetchSTT({
          provider: useNiumaAPI ? undefined : providerConfig,
          selectedProvider: selectedSttProvider,
          audio: audioBlob,
          language: sttLanguage,
        });

        if (transcription) {
          onTranscript(transcription);
        }
      } catch (error) {
        onError?.(error);
      } finally {
        setIsTranscribing(false);
      }
    },
  });

  return {
    listening: vad.listening,
    userSpeaking: vad.userSpeaking,
    isTranscribing,
    start: vad.start,
    pause: vad.pause,
  };
}
