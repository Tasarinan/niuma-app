/**
 * MeetingControlBar - start/stop meeting recording + live status indicators.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LoaderCircle, Mic, MicOff, MonitorSpeaker, VideoIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components";
import { VideoInsightsPanel } from "@/pages/video-insights/VideoInsightsPanel";

export function MeetingControlBar({
  isRecording,
  onToggle,
  canUseVoice,
  isProcessingSystemAudio,
  isTranscribingMic,
  isSummarizing,
  segmentCount,
}: {
  isRecording: boolean;
  onToggle: () => void;
  canUseVoice: boolean;
  isProcessingSystemAudio: boolean;
  isTranscribingMic: boolean;
  isSummarizing?: boolean;
  segmentCount: number;
}) {
  const [videoInsightsOpen, setVideoInsightsOpen] = useState(false);
  const { t } = useTranslation("common");

  return (
    <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={!canUseVoice}
          className={cn(
            "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            isRecording
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-indigo-600 text-white hover:bg-indigo-500"
          )}
          title={canUseVoice ? undefined : "请先在“语言”页面配置语音识别服务"}
        >
          {isRecording ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
          {isRecording ? t("meeting.stopMeeting") : t("meeting.startMeeting")}
        </button>

        <Dialog open={videoInsightsOpen} onOpenChange={setVideoInsightsOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
              title={t("meeting.videoInsights")}
            >
              <VideoIcon className="size-3.5" />
              {t("meeting.videoInsights")}
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-[24px] border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <DialogHeader>
              <DialogTitle>{t("meeting.videoInsights")}</DialogTitle>
              <DialogDescription>
                {t("meeting.videoInsightsDesc")}
              </DialogDescription>
            </DialogHeader>
            <VideoInsightsPanel />
          </DialogContent>
        </Dialog>

        {isRecording && (
          <span className="flex items-center gap-1.5 text-[11px] text-red-500">
            <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
            {t("meeting.transcribing")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-slate-400">
        {isRecording && (
          <span className="flex items-center gap-1" title={t("meeting.systemAudio")}>
            {isProcessingSystemAudio ? (
              <LoaderCircle className="size-3.5 animate-spin text-blue-500" />
            ) : (
              <MonitorSpeaker className="size-3.5" />
            )}
          </span>
        )}
        {isRecording && isTranscribingMic && (
          <span className="flex items-center gap-1" title={t("meeting.transcribingMic")}>
            <LoaderCircle className="size-3.5 animate-spin text-indigo-500" />
          </span>
        )}
        {isSummarizing && (
          <span className="flex items-center gap-1 text-indigo-500" title={t("meeting.generatingSummary")}>
            <LoaderCircle className="size-3.5 animate-spin" />
            总结中…
          </span>
        )}
        <span>{t("meeting.segmentCount", { count: segmentCount })}</span>
      </div>
    </div>
  );
}
