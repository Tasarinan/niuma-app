import { UserIcon, Paperclip, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components";
import type { StudioMessage } from "@/types";
import { StudioAvatar } from "./StudioAvatar";
import { ToolCallCard } from "./ToolCallCard";
import { PlanCard } from "./PlanCard";

/**
 * A single message in the Studio thread. Renders four shapes cohesively:
 * user, streaming agent reply, PI tool-call cards, and a Planning card.
 */
export function MessageBubble({
  message,
  streaming,
  onConfirmPlan,
  isBusy,
}: {
  message: StudioMessage;
  streaming: boolean;
  onConfirmPlan: () => void;
  isBusy: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <StudioAvatar
          avatar={message.agentAvatar}
          name={message.agentName}
          className="mt-0.5 size-6"
        />
      )}
      <div
        className={cn(
          "flex min-w-0 max-w-[82%] flex-col gap-0.5",
          isUser ? "items-end" : "items-start"
        )}
      >
        {!isUser && message.agentName && (
          <span className="pl-1 text-[10px] text-muted-foreground">
            {message.agentName}
            {message.role === "agent" && (
              <span className="ml-1 opacity-60">· PI</span>
            )}
          </span>
        )}

        {/* Attachments (user) */}
        {isUser && message.attachments && message.attachments.length > 0 && (
          <div className="mb-0.5 flex flex-wrap justify-end gap-1">
            {message.attachments.map((a) =>
              a.kind === "image" ? (
                <img
                  key={a.id}
                  src={`data:${a.mimeType};base64,${a.data}`}
                  alt={a.name}
                  className="size-14 rounded-lg border object-cover"
                />
              ) : (
                <span
                  key={a.id}
                  className="flex items-center gap-1 rounded-lg border bg-muted/60 px-2 py-1 text-[10px] text-muted-foreground"
                >
                  <Paperclip className="size-3" />
                  {a.name}
                </span>
              )
            )}
          </div>
        )}

        {/* Text bubble */}
        {(message.content.trim() || streaming) && (
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2 text-xs leading-relaxed",
              isUser
                ? "rounded-tr-sm bg-fuchsia-500 text-white"
                : "rounded-tl-sm bg-muted/70"
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              <Markdown>{message.content || "…"}</Markdown>
            )}
          </div>
        )}

        {/* PI tool calls */}
        {!isUser && message.tools && message.tools.length > 0 && (
          <div className="mt-1 flex w-full flex-col gap-1">
            {message.tools.map((t) => (
              <ToolCallCard key={t.toolCallId} tool={t} />
            ))}
          </div>
        )}

        {/* Planning card */}
        {message.plan && (
          <PlanCard message={message} onConfirm={onConfirmPlan} isBusy={isBusy} />
        )}
      </div>
      {isUser && (
        <div className="mt-0.5 flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-fuchsia-500">
          <UserIcon className="size-3 text-white" />
        </div>
      )}
    </div>
  );
}

/** Small legend chip used in empty states. */
export function AttachmentHint() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <ImageIcon className="size-3" /> 支持图片 / 文件附件
    </span>
  );
}
