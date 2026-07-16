import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { InfoIcon, MicIcon, LoaderCircleIcon, Users } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useI18n } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
} from "@/components";
import { AutoSpeechVAD } from "./AutoSpeechVad";
import { UseCompletionReturn } from "@/types";
import { useApp } from "@/store";
import { useMeetingAudio, useTranslation, useSpeakerDiarization } from "@/hooks";
import { STORAGE_KEYS } from "@/config";
import { secureGet, migrateFromLocalStorage } from "@/lib";

export const Audio = ({
  micOpen,
  setMicOpen,
  enableVAD,
  setEnableVAD,
  submit,
  setState,
  meetingAssistMode,
  addMeetingTranscript,
  addSystemAudioTranscript,
  updateTranscriptTranslation,
  updateEntrySpeaker,
  meetingTranscript,
}: UseCompletionReturn) => {
  const { selectedSttProvider, allSttProviders, NiumaApiEnabled, selectedAudioDevices, sttLanguage } =
    useApp();
  const { translate, isEnabled: translationEnabled } = useTranslation();
  const { t } = useI18n("pages");

  // Phase 3: Check if diarization is enabled
  const diarizationEnabled = useMemo(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEYS.SPEAKER_DIARIZATION_ENABLED) === "true";
  }, []);

  // Load API key from secure storage (with migration from localStorage)
  const [assemblyAIKey, setAssemblyAIKey] = useState("");

  useEffect(() => {
    const loadApiKey = async () => {
      try {
        // Migrate from localStorage if exists (one-time migration)
        await migrateFromLocalStorage(STORAGE_KEYS.ASSEMBLYAI_API_KEY, true);

        // Load from secure storage
        const key = await secureGet(STORAGE_KEYS.ASSEMBLYAI_API_KEY);
        setAssemblyAIKey(key || "");
      } catch (error) {
        console.error("[Audio] Failed to load API key from secure storage:", error);
        toast.error("Failed to load AssemblyAI API key", {
          description: "Secure storage error. Speaker diarization may not work. Please restart the application.",
        });
        // DO NOT fallback to localStorage - this would defeat the security purpose
        setAssemblyAIKey("");
      }
    };

    loadApiKey();
  }, []);

  // Keep meetingTranscript in a ref for the getTranscriptEntries callback
  const meetingTranscriptRef = useRef(meetingTranscript);
  meetingTranscriptRef.current = meetingTranscript;

  // Phase 3: Speaker diarization hook
  // Note: resetRegistry is available for future use when meeting ends
  const { createAudioBuffer } = useSpeakerDiarization({
    apiKey: assemblyAIKey,
    language: sttLanguage,
    updateEntrySpeaker,
    getTranscriptEntries: useCallback(() => meetingTranscriptRef.current, []),
    onBatchProcessed: (batchId, speakerCount) => {
      console.log(`[Audio] Diarization batch ${batchId} processed with ${speakerCount} speakers`);
    },
    onError: (error) => {
      // Security: Sanitize error before logging (never expose API keys)
      const sanitizedMessage = error instanceof Error ? error.message : String(error);
      console.error("[Audio] Diarization error:", sanitizedMessage);
      // Don't show error to user - diarization is a background feature
    },
  });

  // Phase 3: Create audio buffer for diarization (only when conditions are met)
  const audioBuffer = useMemo(() => {
    if (meetingAssistMode && enableVAD && diarizationEnabled && assemblyAIKey) {
      return createAudioBuffer();
    }
    return null;
  }, [meetingAssistMode, enableVAD, diarizationEnabled, assemblyAIKey, createAudioBuffer]);

  // Get STT provider config for system audio
  const sttProviderConfig = allSttProviders.find(
    (p) => p.id === selectedSttProvider.provider
  );

  // Handler for system audio transcripts with translation support
  const handleSystemAudioTranscript = useCallback(
    (text: string, timestamp: number) => {
      addSystemAudioTranscript(text, timestamp);

      // Translate in background if enabled
      if (translationEnabled) {
        translate(text).then((result) => {
          if (result.success && result.translation) {
            updateTranscriptTranslation(timestamp, result.translation);
          } else if (result.error) {
            updateTranscriptTranslation(timestamp, undefined, result.error);
          }
        });
      }
    },
    [addSystemAudioTranscript, translationEnabled, translate, updateTranscriptTranslation]
  );

  // System audio capture for Meeting Assist Mode
  // Only enabled when both meetingAssistMode and enableVAD are true
  // Phase 3: Pass audioBuffer for diarization when enabled
  const { isProcessing: isProcessingSystemAudio } = useMeetingAudio({
    enabled: meetingAssistMode && enableVAD,
    onSystemAudioTranscript: handleSystemAudioTranscript,
    onError: (error) => {
      // Show toast notification for audio capture failures
      console.error('[Audio] System audio capture error:', error.message);
      toast.error("Audio Capture Failed", {
        description: error.message,
        duration: 5000,
      });
    },
    sttProvider: sttProviderConfig,
    selectedSttProvider,
    sttLanguage,
    outputDeviceId: selectedAudioDevices.output,
    audioBuffer, // Phase 3: Buffer for batch diarization
  });

  const speechProviderStatus = selectedSttProvider.provider;
  const canUseVoice = NiumaApiEnabled || speechProviderStatus;

  return (
    <div className="flex items-center gap-1">
      {/* Mic Button with Popover */}
      <Popover open={micOpen} onOpenChange={setMicOpen}>
        <PopoverTrigger asChild>
          {canUseVoice && enableVAD ? (
            <AutoSpeechVAD
              key={selectedAudioDevices.input}
              submit={submit}
              setState={setState}
              setEnableVAD={setEnableVAD}
              microphoneDeviceId={selectedAudioDevices.input}
              meetingAssistMode={meetingAssistMode}
              addMeetingTranscript={addMeetingTranscript}
              updateTranscriptTranslation={updateTranscriptTranslation}
              sttLanguage={sttLanguage}
            />
          ) : (
            <Button
              size="icon"
              onClick={() => {
                if (canUseVoice) {
                  setEnableVAD(!enableVAD);
                }
              }}
              className="cursor-pointer"
              title={canUseVoice ? t("speechInputStatus.toggleVoiceInput") : t("speechInputStatus.configureProviderFirst")}
            >
              <MicIcon className="h-4 w-4" />
            </Button>
          )}
        </PopoverTrigger>

        <PopoverContent
          align="end"
          side="bottom"
          className={`w-80 p-3 ${canUseVoice ? "hidden" : ""}`}
          sideOffset={8}
        >
          <div className="text-sm select-none">
            <div className="font-semibold text-orange-600 mb-1">
              {t("speechInputStatus.configRequiredTitle")}
            </div>
            <p className="text-muted-foreground">
              {!speechProviderStatus ? (
                <>
                  <div className="mt-2 flex flex-row gap-1 items-center text-orange-600">
                    <InfoIcon size={16} />
                    {selectedSttProvider.provider ? null : (
                      <p>{t("speechInputStatus.providerMissing")}</p>
                    )}
                  </div>

                  <span className="block mt-2">
                    {t("speechInputStatus.configureHint")}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </PopoverContent>
      </Popover>

      {/* Guest Audio Indicator - Shows when processing system audio in Meeting Mode */}
      {meetingAssistMode && enableVAD && (
        <Button
          size="icon"
          variant="outline"
          disabled
          className="cursor-default"
          title={isProcessingSystemAudio ? t("speechInputStatus.processingGuestAudio") : t("speechInputStatus.listeningGuestAudio")}
        >
          {isProcessingSystemAudio ? (
            <LoaderCircleIcon className="h-4 w-4 animate-spin text-blue-500" />
          ) : (
            <Users className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      )}
    </div>
  );
};
