import { UseCompletionReturn } from "@/types";
import { LoaderCircleIcon, MicIcon, MicOffIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components";
import { useMicVadTranscription } from "@/hooks";

interface AutoSpeechVADProps {
  sendToMainChat: UseCompletionReturn["sendToMainChat"];
  setState: UseCompletionReturn["setState"];
  setEnableVAD: UseCompletionReturn["setEnableVAD"];
  microphoneDeviceId: string;
  sttLanguage?: string;
}

export interface AutoSpeechVADState {
  listening: boolean;
  userSpeaking: boolean;
  isTranscribing: boolean;
  start: () => void;
  pause: () => void;
}

/**
 * Headless hook containing the VAD listen + STT transcribe + submit logic.
 * Extracted so callers can drive their own button UI (e.g. Toolbar) from
 * the capture state without needing to render this file's own <Button>.
 *
 * The actual VAD/STT capture pipeline lives in the shared useMicVadTranscription
 * hook (@/hooks) - this wrapper only adds what's specific to the completion
 * widget: routing the transcript into the main chat bridge and surfacing the
 * capture state to the toolbar.
 */
const useAutoSpeechVAD = ({
  sendToMainChat,
  setState,
  microphoneDeviceId,
  sttLanguage = "en",
}: Omit<AutoSpeechVADProps, "setEnableVAD">): AutoSpeechVADState => {
  const { listening, userSpeaking, isTranscribing, start, pause } = useMicVadTranscription({
    microphoneDeviceId,
    sttLanguage,
    startOnLoad: true,
    onTranscript: (transcription) => {
      void sendToMainChat(transcription);
    },
    onError: (error) => {
      console.error("Failed to transcribe audio:", error);
      setState((prev: any) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Transcription failed",
      }));
    },
  });

  return { listening, userSpeaking, isTranscribing, start, pause };
};

const AutoSpeechVADInternal = ({
  setEnableVAD,
  ...rest
}: AutoSpeechVADProps) => {
  const { listening, userSpeaking, isTranscribing, start, pause } =
    useAutoSpeechVAD(rest);

  return (
    <>
      <Button
        size="icon"
        onClick={() => {
          if (listening) {
            pause();
            setEnableVAD(false);
          } else {
            start();
            setEnableVAD(true);
          }
        }}
        className="cursor-pointer"
      >
        {isTranscribing ? (
          <LoaderCircleIcon className="h-4 w-4 animate-spin text-green-500" />
        ) : userSpeaking ? (
          <LoaderCircleIcon className="h-4 w-4 animate-spin" />
        ) : listening ? (
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

export interface AutoSpeechVADHeadlessProps
  extends Omit<AutoSpeechVADProps, "setEnableVAD"> {
  onStateChange: (state: AutoSpeechVADState) => void;
}

const AutoSpeechVADHeadlessInternal = ({
  onStateChange,
  ...rest
}: AutoSpeechVADHeadlessProps) => {
  const vadState = useAutoSpeechVAD(rest);

  useEffect(() => {
    onStateChange(vadState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vadState.listening, vadState.userSpeaking, vadState.isTranscribing]);

  return null;
};

/**
 * Headless variant of AutoSpeechVAD — runs the same VAD listen + STT
 * transcribe + submit logic but renders no UI of its own, so a caller
 * (e.g. Toolbar) can keep its existing button UI unchanged and only
 * wire the real capture state/controls into it.
 */
export const AutoSpeechVADHeadless = (props: AutoSpeechVADHeadlessProps) => {
  return <AutoSpeechVADHeadlessInternal key={props.microphoneDeviceId} {...props} />;
};
