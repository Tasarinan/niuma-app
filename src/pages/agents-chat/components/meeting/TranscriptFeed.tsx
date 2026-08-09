/**
 * TranscriptFeed - center-column live transcript for a Meeting Channel.
 * Adapted from pages/app/components/completion/MeetingTranscriptPanel.tsx.
 *
 * Tab A – Live transcript (default)
 *   • Shows real-time transcript entries.
 *   • "保存快照" saves the current transcript to SQLite.
 * Tab B – 历史快照
 *   • Lists all persisted snapshots (title, time, count, preview).
 *   • Each row has an expand toggle and a delete button.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, History, Loader2, Mic, SaveIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";
import { Button, ScrollArea, SpeakerTaggingPopover } from "@/components";
import { useApp } from "@/store";
import { SpeakerIdFactory } from "@/types";
import { cn } from "@/lib/utils";
import type { SpeakerInfo, TranscriptEntry, MeetingSnapshot } from "@/types";

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

// ── Snapshot row ─────────────────────────────────────────────────────────────

function SnapshotRow({
  snapshot,
  onDelete,
}: {
  snapshot: MeetingSnapshot;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{snapshot.title}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {new Date(snapshot.createdAt).toLocaleString()} · {snapshot.entryCount} 条
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
            title={expanded ? "收起" : "展开转录"}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(snapshot.id)}
            className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
            title="删除快照"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Expandable transcript text */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-2">
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600">
            {snapshot.transcript}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Snapshots panel ──────────────────────────────────────────────────────────

function SnapshotsPanel({
  snapshots,
  onDelete,
}: {
  snapshots: MeetingSnapshot[];
  onDelete: (id: string) => void;
}) {
  if (snapshots.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-slate-50 text-slate-400">
        <History className="size-7 text-slate-200" />
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-500">暂无保存的快照</p>
          <p className="mt-1 text-xs">在转录视图中点击"保存快照"将当前记录持久化</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="space-y-3 p-4">
        {snapshots.map((s) => (
          <SnapshotRow key={s.id} snapshot={s} onDelete={onDelete} />
        ))}
      </div>
    </ScrollArea>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function TranscriptFeed({
  transcript,
  clearTranscript,
  assignSpeaker,
  isRecording,
  micListening,
  snapshots = [],
  onSaveSnapshot,
  onDeleteSnapshot,
}: {
  transcript: TranscriptEntry[];
  clearTranscript: () => void;
  assignSpeaker: (speakerId: string, label: string, profileId?: string) => void;
  isRecording?: boolean;
  micListening?: boolean;
  snapshots?: MeetingSnapshot[];
  onSaveSnapshot?: () => Promise<MeetingSnapshot | null>;
  onDeleteSnapshot?: (id: string) => void;
}) {
  const { sttTranslationEnabled } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"live" | "snapshots">("live");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (tab !== "live") return;
    const viewport = scrollRef.current?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]"
    );
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [transcript.length, tab]);

  const handleSave = async () => {
    if (!onSaveSnapshot || isSaving) return;
    setIsSaving(true);
    try {
      const result = await onSaveSnapshot();
      if (result) {
        toast.success("快照已保存", {
          description: `"${result.title}" 已持久化到数据库`,
        });
      }
    } catch {
      toast.error("保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const liveEmpty = transcript.length === 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {/* ── Tab header ── */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-2">
        {/* Tab switcher */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
          <button
            type="button"
            onClick={() => setTab("live")}
            className={cn(
              "rounded-md px-3 py-1 text-[11px] font-medium transition-colors",
              tab === "live"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            实时转录
            {transcript.length > 0 && (
              <span className="ml-1 text-slate-400">{transcript.length}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("snapshots")}
            className={cn(
              "flex items-center gap-1 rounded-md px-3 py-1 text-[11px] font-medium transition-colors",
              tab === "snapshots"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <History className="h-3 w-3" />
            历史快照
            {snapshots.length > 0 && (
              <span className="ml-0.5 text-slate-400">{snapshots.length}</span>
            )}
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {tab === "live" && (
            <>
              {onSaveSnapshot && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSave}
                  disabled={liveEmpty || isSaving}
                  className="h-7 gap-1 px-2 text-xs text-slate-400 hover:text-indigo-600 disabled:opacity-40"
                  title="将当前转录保存为快照"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <SaveIcon className="h-3.5 w-3.5" />
                  )}
                  保存快照
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={clearTranscript}
                disabled={liveEmpty}
                className="h-7 px-2 text-xs text-slate-400 hover:text-red-500 disabled:opacity-40"
              >
                <TrashIcon className="mr-1 h-3.5 w-3.5" />
                清空
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Tab body ── */}
      {tab === "snapshots" ? (
        <SnapshotsPanel snapshots={snapshots} onDelete={onDeleteSnapshot ?? (() => {})} />
      ) : liveEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-slate-50 text-slate-400">
          {isRecording ? (
            <>
              <span className="flex size-10 items-center justify-center rounded-full bg-red-50 ring-4 ring-red-100">
                <Mic className={cn("size-5 text-red-500", micListening && "animate-pulse")} />
              </span>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-600">
                  {micListening ? "正在监听发言…" : "等待语音输入"}
                </p>
                <p className="mt-1 text-xs text-slate-400">转录内容将实时显示在这里</p>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] text-red-500">
                <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
                录音中
              </span>
            </>
          ) : (
            <>
              <Mic className="size-7 text-slate-200" />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-500">会议转录尚未开始</p>
                <p className="mt-1 text-xs">点击顶部"开始会议"按钮，实时转录将显示在这里</p>
              </div>
            </>
          )}
        </div>
      ) : (
        <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
          <div className="space-y-3 p-5">
            {transcript.map((entry) => {
              const speakerLabel = getSpeakerLabel(entry.speaker);
              const speakerId = entry.speaker?.speakerId || "guest";
              const hasSpeaker = !!entry.speaker;

              return (
                <div
                  key={entry.timestamp}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
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
                    <div className="mt-2 border-t border-slate-200 pt-2">
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
      )}
    </div>
  );
}

