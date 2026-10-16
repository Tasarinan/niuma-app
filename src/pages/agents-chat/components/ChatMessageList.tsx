import { memo } from "react";
import moment from "moment";
import { Markdown } from "@/components";
import type { GroupMessage, AgentDefinition } from "@/types";
import { cn } from "@/lib/utils";
import { AgentTurnProgress } from "./AgentTurnProgress";
import { AgentAvatar } from "@/components/agent/AgentAvatar";

type TeamStyle = {
  solid?: string;
} | null;

type Props = {
  messages: GroupMessage[];
  agentMap: Record<string, AgentDefinition>;
  streamingIds: Set<string>;
  activeTeamStyle: TeamStyle;
  emptyLabel: string;
};

function MessageAvatar({
  src,
  label,
}: {
  src?: string;
  label: string;
}) {
  return (
    <AgentAvatar src={src} label={label} className="size-8 rounded-full" glyphClassName="text-xs" />
  );
}

export const ChatMessageList = memo(function ChatMessageList({
  messages,
  agentMap,
  streamingIds,
  activeTeamStyle,
  emptyLabel,
}: Props) {
  if (messages.length === 0) {
    return (
      <div className="mx-auto flex min-h-full max-w-xl items-center text-sm text-slate-400">
        {emptyLabel}
      </div>
    );
  }

  return (
    <>
      {messages.map((msg) => {
        const agent = msg.agentId ? agentMap[msg.agentId] : undefined;
        const isUser = msg.role === "user";
        const streaming = streamingIds.has(msg.id);
        return (
          <div
            key={msg.id}
            className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}
          >
            {!isUser && (
              <MessageAvatar
                src={agent?.avatar ?? msg.agentAvatar}
                label={msg.agentName ?? agent?.name ?? "AI"}
              />
            )}
            <div
              className={cn(
                "flex max-w-[72%] flex-col gap-1",
                isUser ? "items-end" : "items-start",
              )}
            >
              {!isUser && (
                <span className="text-xs font-medium text-slate-600">
                  {msg.agentName ?? agent?.name}
                </span>
              )}
              <div
                className={cn(
                  "overflow-x-auto rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
                  isUser
                    ? cn("rounded-tr-md text-white", activeTeamStyle?.solid ?? "bg-[#7771e8]")
                    : "rounded-tl-md bg-white text-slate-800 ring-1 ring-slate-100",
                )}
              >
                {isUser && msg.images && msg.images.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {msg.images.map((img, i) => (
                      <img
                        key={i}
                        src={`data:${img.mimeType};base64,${img.data}`}
                        alt=""
                        className="size-14 rounded-lg object-cover ring-1 ring-white/30"
                      />
                    ))}
                  </div>
                )}
                {!isUser && (
                  <AgentTurnProgress
                    steps={msg.toolProgress}
                    streaming={streaming && !msg.content}
                  />
                )}
                {msg.content && <Markdown>{msg.content}</Markdown>}
              </div>
              <span className="text-[10px] text-slate-400">
                {moment(msg.timestamp).format("HH:mm")}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
});
