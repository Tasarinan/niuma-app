/**
 * TranscriptFeed - center-column live transcript for a Meeting Channel.
 * Adapted from pages/app/components/completion/MeetingTranscriptPanel.tsx.
 */
import { useEffect, useRef } from "react";
import { Loader2, TrashIcon } from "lucide-react";
import { Button, ScrollArea, SpeakerTaggingPopover } from "@/components";
import { useApp } from "@/store";
import { SpeakerIdFactory } from "@/types";
import type { SpeakerInfo, TranscriptEntry } from "@/types";

const SPEAKER_COLORS: Record<string, string> = {
  you: "bg-indigo-50 text-indigo-600 border-indigo-200",
  A: "bg-emerald-50 text-emerald-600 border-emerald-200",
  B: "bg-orange-50 text-orange-600 border-orange-200",
  C: "bg-purple-50 text-purple-600 border-purple-200",
  D: "bg-pink-50 text-pink-600 border-pink-200",
  E: "bg-teal-50 text-teal-600 border-teal-200",
  F: "bg-yellow-50 text-yellow-700 border-yellow-200",
  guest: "bg-slate-100 text-slate-500 border-slate-200",
};

function getSpeakerColor(speakerId: string): string {
  if (speakerId === SpeakerIdFactory.you()) {
    return SPEAKER_COLORS.you;
  }
  if (speakerId.startsWith("diarization_")) {
    const label = speakerId.replace("diarization_", "");
    return SPEAKER_COLORS[label] ?? SPEAKER_COLORS.guest;
  }
  return SPEAKER_COLORS.guest;
}

function getSpeakerLabel(speaker?: SpeakerInfo): string | undefined {
  return speaker?.speakerLabel;
}

export function TranscriptFeed({
  transcript,
  clearTranscript,
  assignSpeaker,
}: {
  transcript: TranscriptEntry[];
  clearTranscript: () => void;
  assignSpeaker: (speakerId: string, label: string, profileId?: string) => void;
}) {
  const { sttTranslationEnabled } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]"
    );
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [transcript.length]);

  if (transcript.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
        <p className="text-sm font-semibold text-slate-500">会议转录尚未开始</p>
        <p className="text-xs">点击顶部“开始会议”按钮，实时转录将显示在这里</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-2">
        <span className="text-[11px] font-medium text-slate-400">
          {transcript.length} 条转录
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={clearTranscript}
          className="h-7 px-2 text-xs text-slate-400 hover:text-red-500"
        >
          <TrashIcon className="mr-1 h-3.5 w-3.5" />
          清空
        </Button>
      </div>
      <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
        <div className="space-y-3 p-5">
          {transcript.map((entry) => {
            const speakerLabel = getSpeakerLabel(entry.speaker);
            const speakerId = entry.speaker?.speakerId || "guest";
            const hasSpeaker = !!entry.speaker;

            return (
              <div
                key={entry.timestamp}
                className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm shadow-sm"
              >
                <div className="mb-1 flex items-center gap-2">
                  {hasSpeaker && speakerLabel && (
                    <SpeakerTaggingPopover speakerId={speakerId} onAssign={assignSpeaker}>
                      <button
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80 ${getSpeakerColor(
                          speakerId
                        )}`}
                      >
                        {speakerLabel}
                      </button>
                    </SpeakerTaggingPopover>
                  )}
                  <span className="text-[10px] text-slate-400">
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p className="text-slate-800">{entry.original}</p>

                {sttTranslationEnabled && (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    {entry.translation ? (
                      <p className="italic text-slate-500" dir="auto">
                        {entry.translation}
                      </p>
                    ) : entry.translationError ? (
                      <p className="text-xs text-red-400">翻译失败</p>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>翻译中…</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
