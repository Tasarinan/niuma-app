import { useState, useRef, useEffect } from "react";
import { Button } from "@/components";
import { AudioVisualizer } from "@/pages/app/components/speech/audio-visualizer";
import { shouldUseNiumaAPI, fetchSTT } from "@/lib";
import { useApp } from "@/contexts";
import { StopCircle, Send } from "lucide-react";

interface AudioRecorderProps {
  onTranscriptionComplete: (text: string) => void;
  onCancel: () => void;
}

const MAX_DURATION = 3 * 60 * 1000;

export const AudioRecorder = ({
  onTranscriptionComplete,
  onCancel,
}: AudioRecorderProps) => {
  const { selectedSttProvider, allSttProviders, sttLanguage } = useApp();
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxDurationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startRecording();
    return () => cleanup();
  }, []);

  const cleanup = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
      setAudioStream(null);
    }
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      startTimeRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);

      durationIntervalRef.current = setInterval(() => {
        setDuration(Date.now() - startTimeRef.current);
      }, 100);

      maxDurationTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          handleSend();
        }
      }, MAX_DURATION);
    } catch (error) {
      console.error("Failed to start recording:", error);
      cleanup();
      onCancel();
    }
  };

  const handleStop = () => {
    cleanup();
    onCancel();
  };

  const handleSend = async () => {
    if (!mediaRecorderRef.current || isTranscribing) return;

    setIsTranscribing(true);

    const mimeType = mediaRecorderRef.current.mimeType;
    const chunks = [...audioChunksRef.current];

    cleanup();

    try {
      const audioBlob = new Blob(chunks, { type: mimeType });

      const useNiumaAPI = await shouldUseNiumaAPI();
      const provider = allSttProviders.find(
        (p) => p.id === selectedSttProvider.provider
      );

      const text = await fetchSTT({
        provider: useNiumaAPI ? undefined : provider,
        selectedProvider: selectedSttProvider,
        audio: audioBlob,
        language: sttLanguage,
      });

      onTranscriptionComplete(text);
    } catch (error) {
      console.error("Transcription failed:", error);
      onCancel();
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="border bg-background rounded-lg overflow-hidden">
      <div className="h-12 relative bg-muted/20">
        {audioStream ? (
          <div className="h-full w-full pt-3">
            <AudioVisualizer stream={audioStream} isRecording={true} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Initializing...
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/5">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-mono tabular-nums font-medium">
            {formatTime(duration)}
          </span>
          <span className="text-xs text-muted-foreground">/ 3:00</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={handleStop}
            disabled={isTranscribing}
            className="h-8 w-8"
            title="Stop recording"
          >
            <StopCircle className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            onClick={handleSend}
            disabled={isTranscribing}
            className="h-8 w-8"
            title={isTranscribing ? "Sending..." : "Send to AI"}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
