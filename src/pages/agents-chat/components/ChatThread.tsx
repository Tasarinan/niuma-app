import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import type { StudioMessage } from "@/types";
import { MessageBubble, AttachmentHint } from "./MessageBubble";

/** The center discussion column: scrolling list of Studio messages. */
export function ChatThread({
  messages,
  streamingIds,
  onConfirmPlan,
  isBusy,
}: {
  messages: StudioMessage[];
  streamingIds: Set<string>;
  onConfirmPlan: (message: StudioMessage) => void;
  isBusy: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-fuchsia-500/10">
          <Sparkles className="size-6 text-fuchsia-500" />
        </div>
        <p className="text-xs">邀请角色，开始一场共创讨论</p>
        <p className="text-[11px] opacity-70">
          用 <span className="font-mono text-fuchsia-500">@角色名</span> 点名，或开启{" "}
          <span className="font-medium text-fuchsia-500">计划模式</span> 生成结构化大纲
        </p>
        <AttachmentHint />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          streaming={streamingIds.has(msg.id)}
          onConfirmPlan={() => onConfirmPlan(msg)}
          isBusy={isBusy}
        />
      ))}
    </div>
  );
}
