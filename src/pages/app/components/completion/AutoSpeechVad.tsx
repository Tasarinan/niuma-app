import { fetchSTT } from "@/lib";
import { UseCompletionReturn, SpeakerInfo, SpeakerIdFactory } from "@/types";
import { useMicVAD } from "@ricky0123/vad-react";
import { LoaderCircleIcon, MicIcon, MicOffIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components";
import { useApp } from "@/store";
import { floatArrayToWav } from "@/lib/utils";
import { shouldUseNiumaAPI } from "@/lib/functions/Niuma.api";
import { useTranslation } from "@/hooks";

interface AutoSpeechVADProps {
  submit: UseCompletionReturn["submit"];
  setState: UseCompletionReturn["setState"];
  setEnableVAD: UseCompletionReturn["setEnableVAD"];
  microphoneDeviceId: string;
  meetingAssistMode?: boolean;
  addMeetingTranscript?: UseCompletionReturn["addMeetingTranscript"];
  updateTranscriptTranslation?: UseCompletionReturn["updateTranscriptTranslation"];
  sttLanguage?: string;
}

const AutoSpeechVADInternal = ({
  submit,
  setState,
  setEnableVAD,
  microphoneDeviceId,
  meetingAssistMode = false,
  addMeetingTranscript,
  updateTranscriptTranslation,
  sttLanguage = "en",
}: AutoSpeechVADProps) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const { selectedSttProvider, allSttProviders } = useApp();
  const { translate, isEnabled: translationEnabled } = useTranslation();

  const audioConstraints: MediaTrackConstraints = microphoneDeviceId
    ? { deviceId: { exact: microphoneDeviceId } }
    : { deviceId: "default" };

  const vad = useMicVAD({
    userSpeakingThreshold: 0.6,
    startOnLoad: true,
    additionalAudioConstraints: audioConstraints,
    onSpeechEnd: async (audio) => {
      try {
        // convert float32array to blob
        const audioBlob = floatArrayToWav(audio, 16000, "wav");

        let transcription: string;
        const useNiumaAPI = await shouldUseNiumaAPI();

        // Check if we have a configured speech provider
        if (!selectedSttProvider.provider && !useNiumaAPI) {
          console.warn("No speech provider selected");
          setState((prev: any) => ({
            ...prev,
            error:
              "No speech provider selected. Please select one in settings.",
          }));
          return;
        }

        const providerConfig = allSttProviders.find(
          (p) => p.id === selectedSttProvider.provider
        );

        if (!providerConfig && !useNiumaAPI) {
          console.warn("Selected speech provider configuration not found");
          setState((prev: any) => ({
            ...prev,
            error:
              "Speech provider configuration not found. Please check your settings.",
          }));
          return;
        }

        setIsTranscribing(true);

        // Microphone audio always uses standard STT (no diarization)
        // Diarization is only for system audio (handled in useMeetingAudio.ts)
        // This ensures microphone audio is always labeled as "You"
        transcription = await fetchSTT({
          provider: useNiumaAPI ? undefined : providerConfig,
          selectedProvider: selectedSttProvider,
          audio: audioBlob,
          language: sttLanguage,
        });

        if (transcription) {
          if (meetingAssistMode && addMeetingTranscript) {
            // In Meeting Assist Mode, accumulate transcripts instead of auto-submitting
            // Phase 1: Label all microphone audio as "You"
            const microphoneSpeaker: SpeakerInfo = {
              speakerId: SpeakerIdFactory.you(),
              speakerLabel: 'You',
              confirmed: true,
            };
            const timestamp = addMeetingTranscript(transcription, microphoneSpeaker, 'microphone');

            // Translate in background if enabled
            if (translationEnabled && updateTranscriptTranslation) {
              translate(transcription).then((result) => {
                if (result.success && result.translation) {
                  updateTranscriptTranslation(timestamp, result.translation);
                } else if (result.error) {
                  updateTranscriptTranslation(timestamp, undefined, result.error);
                }
              });
            }
          } else {
            // Normal mode: auto-submit to AI
            submit(transcription);
          }
        }
      } catch (error) {
        console.error("Failed to transcribe audio:", error);
        setState((prev: any) => ({
          ...prev,
          error:
            error instanceof Error ? error.message : "Transcription failed",
        }));
      } finally {
        setIsTranscribing(false);
      }
    },
  });

  return (
    <>
      <Button
        size="icon"
        onClick={() => {
          if (vad.listening) {
            vad.pause();
            setEnableVAD(false);
          } else {
            vad.start();
            setEnableVAD(true);
          }
        }}
        className="cursor-pointer"
      >
        {isTranscribing ? (
          <LoaderCircleIcon className="h-4 w-4 animate-spin text-green-500" />
        ) : vad.userSpeaking ? (
          <LoaderCircleIcon className="h-4 w-4 animate-spin" />
        ) : vad.listening ? (
          <MicOffIcon className="h-4 w-4 animate-pulse" />
        ) : (
          <MicIcon className="h-4 w-4" />
        )}
      </Button>
    </>
  );
};

export const AutoSpeechVAD = (props: AutoSpeechVADProps) => {
  return <AutoSpeechVADInternal key={props.microphoneDeviceId} {...props} />;
};
