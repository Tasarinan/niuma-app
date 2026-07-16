/**
 * MeetingControlBar - start/stop meeting recording + live status indicators.
 */
import { useState } from "react";
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

  return (
    <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 bg-white/80 px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={!canUseVoice}
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold shadow transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            isRecording
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-indigo-600 text-white hover:bg-indigo-500"
          )}
          title={canUseVoice ? undefined : "请先在“语言”页面配置语音识别服务"}
        >
          {isRecording ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
          {isRecording ? "结束会议" : "开始会议"}
        </button>

        <Dialog open={videoInsightsOpen} onOpenChange={setVideoInsightsOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
              title="分析一段本地视频，提取要点"
            >
              <VideoIcon className="size-3.5" />
              视频要点分析
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>视频要点分析</DialogTitle>
              <DialogDescription>
                选择一段本地视频，自动转录并提取关键时间点与摘要。
              </DialogDescription>
            </DialogHeader>
            <VideoInsightsPanel />
          </DialogContent>
        </Dialog>

        {isRecording && (
          <span className="flex items-center gap-1.5 text-[11px] text-red-500">
            <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
            正在转录
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-slate-400">
        {isRecording && (
          <span className="flex items-center gap-1" title="系统音频（参会人）">
            {isProcessingSystemAudio ? (
              <LoaderCircle className="size-3.5 animate-spin text-blue-500" />
            ) : (
              <MonitorSpeaker className="size-3.5" />
            )}
          </span>
        )}
        {isRecording && isTranscribingMic && (
          <span className="flex items-center gap-1" title="正在转录麦克风音频">
            <LoaderCircle className="size-3.5 animate-spin text-indigo-500" />
          </span>
        )}
        {isSummarizing && (
          <span className="flex items-center gap-1 text-indigo-500" title="正在生成会议总结">
            <LoaderCircle className="size-3.5 animate-spin" />
            总结中…
          </span>
        )}
        <span>{segmentCount} 条转录</span>
      </div>
    </div>
  );
}
