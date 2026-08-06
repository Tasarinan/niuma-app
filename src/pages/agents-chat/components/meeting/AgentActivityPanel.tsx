/**
 * AgentActivityPanel - right-column live workspace showing real-time AI
 * agent reactions during a meeting transcription session.
 *
 * Features:
 * - Smart auto-scroll: only jumps to bottom when user is already near the bottom.
 * - User input bar: lets the human join the discussion; all agents reply.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { BrainCircuit, Loader2, Send, TrashIcon } from "lucide-react";
import { ScrollArea } from "@/components";
import { cn } from "@/lib/utils";
import type { WorkspaceEntry, AgentNote } from "./useMeetingAgents";

// ─── Avatars ──────────────────────────────────────────────────────────────────

function AgentAvatar({ avatar, name }: { avatar?: string; name: string }) {
  if (avatar && /^https?:\/\//.test(avatar)) {
    return <img src={avatar} alt={name} className="size-6 rounded-md object-cover" />;
  }
  if (avatar && avatar.length <= 4) {
    return (
      <span className="flex size-6 items-center justify-center rounded-md bg-indigo-100 text-sm leading-none">
        {avatar}
      </span>
    );
  }
  return (
    <span className="flex size-6 items-center justify-center rounded-md bg-indigo-100 text-[10px] font-bold text-indigo-600">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function AgentCard({ note }: { note: AgentNote }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white p-3 shadow-sm ring-1 transition-shadow",
        note.isStreaming ? "ring-indigo-200 shadow-indigo-50" : "ring-slate-100",
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <AgentAvatar avatar={note.agentAvatar} name={note.agentName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold text-slate-700">{note.agentName}</p>
          {note.agentRole && (
            <p className="truncate text-[9px] text-slate-400">{note.agentRole}</p>
          )}
        </div>
        {note.isStreaming && (
          <Loader2 className="size-3 flex-shrink-0 animate-spin text-indigo-400" />
        )}
      </div>
      <p
        className={cn(
          "whitespace-pre-wrap text-[11px] leading-relaxed",
          note.content ? "text-slate-600" : "text-slate-300 italic",
        )}
      >
        {note.content || "思考中…"}
      </p>
    </div>
  );
}

function UserCard({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-indigo-600 px-3 py-2 text-[11px] leading-relaxed text-white shadow-sm">
        {content}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

/** Pixels from bottom within which we consider the user "at the bottom". */
const NEAR_BOTTOM_THRESHOLD = 80;

export function AgentActivityPanel({
  notes,
  clearNotes,
  onSend,
}: {
  notes: WorkspaceEntry[];
  clearNotes: () => void;
  onSend: (text: string) => Promise<void>;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const atBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    atBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD;
  }, []);

  // Auto-scroll only when the user is already near the bottom.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !atBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [notes.length]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    try {
      await onSend(text);
    } finally {
      setSending(false);
    }
  }, [input, sending, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex w-64 flex-shrink-0 flex-col border-l border-slate-200 bg-slate-50">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <BrainCircuit className="size-3.5 text-indigo-500" />
          <span className="text-[11px] font-semibold text-slate-600">AI 实时工作区</span>
          {notes.length > 0 && (
            <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600">
              {notes.length}
            </span>
          )}
        </div>
        {notes.length > 0 && (
          <button
            type="button"
            onClick={clearNotes}
            className="text-slate-400 transition-colors hover:text-red-500"
            title="清除全部"
          >
            <TrashIcon className="size-3.5" />
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          {/* Locate radix viewport for smart-scroll tracking */}
          <div
            ref={(el) => {
              if (!el) return;
              const root = el.closest("[data-radix-scroll-area-root]");
              const vp = root?.querySelector<HTMLDivElement>(
                "[data-radix-scroll-area-viewport]",
              );
              if (vp && viewportRef.current !== vp) {
                viewportRef.current = vp;
                vp.addEventListener("scroll", handleScroll, { passive: true });
              }
            }}
          />
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
              <BrainCircuit className="size-7 text-slate-200" />
              <p className="text-[11px] leading-relaxed text-slate-400">
                开始会议后，AI 成员将在这里实时监听并做出响应。
                <br />
                你也可以在下方输入加入讨论。
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 p-3">
              {notes.map((entry) =>
                entry.source === "user" ? (
                  <UserCard key={entry.id} content={entry.content} />
                ) : (
                  <AgentCard key={entry.id} note={entry} />
                ),
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-slate-200 bg-white p-2">
        <div className="flex items-end gap-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="加入讨论…"
            rows={1}
            className={cn(
              "min-h-[32px] flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5",
              "text-[11px] text-slate-800 placeholder:text-slate-400",
              "focus:border-indigo-300 focus:bg-white focus:outline-none transition-colors",
            )}
            style={{ maxHeight: 80 }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
            }}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || sending}
            className={cn(
              "flex size-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
              input.trim() && !sending
                ? "bg-indigo-600 text-white hover:bg-indigo-500"
                : "bg-slate-100 text-slate-300",
            )}
          >
            {sending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </button>
        </div>
        <p className="mt-1 text-[9px] text-slate-400">Enter 发送 · Shift+Enter 换行</p>
      </div>
    </div>
  );
}
