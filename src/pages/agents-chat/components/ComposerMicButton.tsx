import { useState } from "react";
import { Loader2, Mic, MicOff } from "lucide-react";
import { useMicVadTranscription } from "@/hooks";
import { useApp } from "@/store";
import { cn } from "@/lib/utils";

function VoiceSession({
  onTranscript,
  onError,
  onStop,
}: {
  onTranscript: (text: string) => void;
  onError: (error: unknown) => void;
  onStop: () => void;
}) {
  const { selectedAudioDevices, sttLanguage } = useApp();
  const { listening, userSpeaking, isTranscribing, pause } = useMicVadTranscription({
    microphoneDeviceId: selectedAudioDevices.input,
    sttLanguage,
    startOnLoad: true,
    onTranscript,
    onError,
  });

  return (
    <button
      type="button"
      title="停止语音输入"
      onClick={() => {
        pause();
        onStop();
      }}
      className={cn(
        "flex size-8 flex-shrink-0 items-center justify-center rounded-md transition-colors",
        "bg-red-50 text-red-500 hover:bg-red-100"
      )}
    >
      {isTranscribing || userSpeaking ? (
        <Loader2 className="size-4 animate-spin" />
      ) : listening ? (
        <MicOff className="size-4 animate-pulse" />
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  );
}

export function ComposerMicButton({
  onTranscript,
  onError,
}: {
  onTranscript: (text: string) => void;
  onError: (error: unknown) => void;
}) {
  const { NiumaApiEnabled, selectedSttProvider } = useApp();
  const canUseVoice = NiumaApiEnabled || Boolean(selectedSttProvider.provider);
  const [armed, setArmed] = useState(false);

  if (armed && canUseVoice) {
    return (
      <VoiceSession
        onTranscript={onTranscript}
        onStop={() => setArmed(false)}
        onError={(error) => {
          setArmed(false);
          onError(error);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      title={canUseVoice ? "语音输入" : "请先在 Speakers 页面配置语音识别"}
      onClick={() => {
        if (!canUseVoice) {
          onError(new Error("请先在 Speakers 页面配置语音识别服务"));
          return;
        }
        setArmed(true);
      }}
      className="flex size-8 flex-shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
    >
      <Mic className="size-4" />
    </button>
  );
}
