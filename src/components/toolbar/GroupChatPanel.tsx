/**
 * GroupChatPanel — Discord-style group-chat floating panel.
 *
 * Rendered absolutely BELOW the toolbar; the parent Toolbar expands the Tauri
 * window height to reveal it.  Messages stack bottom-up (newest at bottom)
 * just like Discord / Driod group conversations.
 */

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import {
  Button,
  Input,
  Label,
  ScrollArea,
  Textarea,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { Markdown } from "@/components";
import {
  Hash,
  Plus,
  Send,
  Trash2,
  Pencil,
  Square,
  UserIcon,
  MessageSquarePlus,
  Users,
  X,
} from "lucide-react";
import moment from "moment";
import { useGroupChat } from "@/hooks/useGroupChat";
import type { GroupChannel, GroupMessage, AgentDefinition } from "@/types";
import { cn } from "@/lib/utils";

// ─── Panel pixel height (excludes the toolbar strip) ─────────────────────────
export const GROUP_CHAT_PANEL_HEIGHT = 480;

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  src,
  name,
  size = 8,
  className,
}: {
  src?: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  const isImage = src?.startsWith("/") || src?.startsWith("http");
  return (
    <div
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden",
        className
      )}
      style={{ width: size * 4, height: size * 4 }}
    >
      {isImage ? (
        <img src={src} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : (
        <span style={{ fontSize: size * 1.8 }}>{src || name?.[0] || "?"}</span>
      )}
    </div>
  );
}

// ─── Channel sidebar ──────────────────────────────────────────────────────────

function ChannelSidebar({
  channels,
  selectedId,
  onSelect,
  onNew,
}: {
  channels: GroupChannel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex w-44 flex-shrink-0 flex-col border-r bg-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          频道
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-5"
          onClick={onNew}
          title="新建频道"
        >
          <Plus className="size-3" />
        </Button>
      </div>

      {/* Channel list */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-1.5">
          {channels.length === 0 && (
            <p className="px-2 py-6 text-center text-[11px] text-muted-foreground leading-relaxed">
              暂无频道<br />点击 + 新建
            </p>
          )}
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => onSelect(ch.id)}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors text-left",
                selectedId === ch.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <span className="text-sm leading-none">{ch.avatar ?? "💬"}</span>
              <span className="flex-1 truncate">{ch.name}</span>
              <span className="text-[9px] opacity-50">{ch.agentIds.length}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Single message row ───────────────────────────────────────────────────────

function MessageRow({
  msg,
  isStreaming,
  showHeader,
  agentDef,
}: {
  msg: GroupMessage;
  isStreaming: boolean;
  showHeader: boolean;
  agentDef?: AgentDefinition;
}) {
  const isUser = msg.role === "user";
  const avatarSrc = isUser ? undefined : (agentDef?.avatar ?? msg.agentAvatar);
  const displayName = isUser
    ? "You"
    : agentDef?.name ?? msg.agentName ?? "Agent";

  return (
    <div
      className={cn(
        "group flex gap-2.5 px-3",
        showHeader ? "mt-3" : "mt-0.5 pl-[44px]"
      )}
    >
      {showHeader && (
        <div className="mt-0.5 flex-shrink-0">
          {isUser ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <UserIcon className="size-3.5 text-primary-foreground" />
            </div>
          ) : (
            <Avatar src={avatarSrc} name={displayName} size={8} />
          )}
        </div>
      )}

      <div className="flex-1 min-w-0">
        {showHeader && (
          <div className="mb-0.5 flex items-baseline gap-1.5">
            <span
              className={cn(
                "text-xs font-semibold",
                isUser ? "text-primary" : ""
              )}
            >
              {displayName}
            </span>
            {!isUser && agentDef?.role && (
              <Badge
                variant="secondary"
                className="h-3.5 px-1 text-[9px] font-normal"
              >
                {agentDef.role}
              </Badge>
            )}
            <span className="text-[9px] text-muted-foreground">
              {moment(msg.timestamp).format("HH:mm")}
            </span>
          </div>
        )}

        <div
          className={cn(
            "text-xs leading-relaxed",
            isStreaming && !msg.content ? "text-muted-foreground" : ""
          )}
        >
          {msg.content ? (
            <Markdown>{msg.content}</Markdown>
          ) : isStreaming ? (
            <span className="inline-flex items-center gap-0.5">
              <span className="size-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
              <span className="size-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
              <span className="size-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Chat area (right pane) ───────────────────────────────────────────────────

function ChatArea({
  channel,
  messages,
  selectedAgents,
  allAgents,
  isSending,
  streamingIds,
  onSend,
  onStop,
  onEdit,
  onDelete,
  onClear,
}: {
  channel: GroupChannel | null;
  messages: GroupMessage[];
  selectedAgents: AgentDefinition[];
  allAgents: AgentDefinition[];
  isSending: boolean;
  streamingIds: Set<string>;
  onSend: (text: string) => void;
  onStop: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingIds.size]);

  const submit = () => {
    if (!input.trim() || isSending) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const agentMap = useMemo(() => {
    const m = new Map<string, AgentDefinition>();
    allAgents.forEach((a) => m.set(a.id, a));
    return m;
  }, [allAgents]);

  if (!channel) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        <MessageSquarePlus className="size-8 opacity-25" />
        <p className="text-xs">选择或新建一个频道开始群聊</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Channel header */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b px-3 py-2">
        <span className="text-sm">{channel.avatar ?? "💬"}</span>
        <span className="text-xs font-semibold truncate flex-1">{channel.name}</span>

        {/* Member avatars */}
        <div className="flex -space-x-1.5">
          {selectedAgents.slice(0, 4).map((a) => (
            <Avatar
              key={a.id}
              src={a.avatar}
              name={a.name}
              size={5}
              className="ring-1 ring-background"
            />
          ))}
          {selectedAgents.length > 4 && (
            <div className="flex size-5 items-center justify-center rounded-full bg-muted ring-1 ring-background text-[9px]">
              +{selectedAgents.length - 4}
            </div>
          )}
        </div>
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Users className="size-2.5" />
          {selectedAgents.length}
        </span>

        {/* Action buttons */}
        <div className="flex gap-0.5 ml-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-5"
            title="编辑频道"
            onClick={onEdit}
          >
            <Pencil className="size-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-5"
            title="清空消息"
            onClick={onClear}
          >
            <Square className="size-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-5 text-destructive/60 hover:text-destructive"
            title="删除频道"
            onClick={onDelete}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      {/* Messages — newest at bottom, scroll up to see history */}
      <ScrollArea className="flex-1 py-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-12 text-muted-foreground">
            <Hash className="size-6 opacity-25" />
            <p className="text-xs">发送第一条消息，启动群聊</p>
            {selectedAgents.length > 0 && (
              <p className="text-[10px] opacity-50">
                成员：{selectedAgents.map((a) => a.name).join("、")}
              </p>
            )}
          </div>
        ) : (
          messages.map((msg, i) => {
            const prev = messages[i - 1];
            const showHeader =
              i === 0 ||
              prev.role !== msg.role ||
              (msg.role === "agent" && prev.agentId !== msg.agentId) ||
              moment(msg.timestamp).diff(
                moment(prev.timestamp),
                "minutes"
              ) > 5;
            return (
              <MessageRow
                key={msg.id}
                msg={msg}
                isStreaming={streamingIds.has(msg.id)}
                showHeader={showHeader}
                agentDef={
                  msg.agentId ? agentMap.get(msg.agentId) : undefined
                }
              />
            );
          })
        )}
        {/* Scroll anchor — keeps view at the latest message */}
        <div ref={messagesEndRef} className="h-2" />
      </ScrollArea>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t px-3 py-2">
        {selectedAgents.length === 0 && (
          <p className="mb-1.5 text-[10px] text-amber-500">
            请先编辑频道，添加 Agent 成员。
          </p>
        )}
        <div className="flex items-end gap-1.5">
          <Textarea
            className="flex-1 resize-none min-h-[32px] max-h-24 py-1.5 text-xs"
            placeholder={`发消息到 ${channel.avatar ?? "#"}${channel.name}…  (@姓名 点名)`}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending || selectedAgents.length === 0}
          />
          {isSending ? (
            <Button
              size="icon"
              variant="outline"
              className="size-7 flex-shrink-0"
              onClick={onStop}
              title="停止"
            >
              <Square className="size-3" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="size-7 flex-shrink-0"
              onClick={submit}
              disabled={!input.trim() || selectedAgents.length === 0}
              title="发送 (Enter)"
            >
              <Send className="size-3" />
            </Button>
          )}
        </div>
        <p className="mt-0.5 text-[9px] text-muted-foreground">
          Enter 发送 · Shift+Enter 换行
        </p>
      </div>
    </div>
  );
}

// ─── Channel create / edit modal ──────────────────────────────────────────────

const CHANNEL_ICONS = [
  "💬","🔥","🚀","💡","🎯","📣","🛠️","🎨","📊","🤝","⚡","🌐","🧪","🏆",
];

function ChannelModal({
  open,
  onOpenChange,
  initial,
  allAgents,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: GroupChannel | null;
  allAgents: AgentDefinition[];
  onSave: (name: string, agentIds: string[], avatar: string) => void;
}) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("💬");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setAvatar(initial?.avatar ?? "💬");
      setSelectedIds(initial?.agentIds ?? []);
      setPickerOpen(false);
    }
  }, [open, initial]);

  const toggle = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), selectedIds, avatar);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {initial ? "编辑频道" : "新建频道"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Avatar + Name */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-xl hover:ring-2 hover:ring-primary/50 transition-all"
              onClick={() => setPickerOpen((v) => !v)}
              title="选择图标"
            >
              {avatar}
            </button>
            <div className="flex-1">
              <Label className="mb-1 block text-[10px]">频道名称 *</Label>
              <Input
                className="h-8 text-xs"
                value={name}
                placeholder="general"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          {/* Icon picker */}
          {pickerOpen && (
            <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-2">
              {CHANNEL_ICONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md text-base transition-colors hover:bg-accent",
                    avatar === e && "ring-2 ring-primary bg-accent"
                  )}
                  onClick={() => {
                    setAvatar(e);
                    setPickerOpen(false);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {/* Agent selector */}
          <div>
            <Label className="mb-1.5 block text-[10px]">
              选择成员（可多选）
            </Label>
            <ScrollArea className="h-44 rounded-md border">
              <div className="grid grid-cols-1 gap-0.5 p-1.5">
                {allAgents.map((agent) => {
                  const sel = selectedIds.includes(agent.id);
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => toggle(agent.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors",
                        sel
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-accent"
                      )}
                    >
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden text-sm">
                        {agent.avatar?.startsWith("/") ||
                        agent.avatar?.startsWith("http") ? (
                          <img
                            src={agent.avatar}
                            alt={agent.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{agent.avatar || "🤖"}</span>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">{agent.name}</div>
                        {agent.role && (
                          <div className="text-[10px] text-muted-foreground">
                            {agent.role}
                          </div>
                        )}
                      </div>
                      {sel && (
                        <span className="text-primary text-[10px]">✓</span>
                      )}
                    </button>
                  );
                })}
                {allAgents.length === 0 && (
                  <p className="p-3 text-center text-[11px] text-muted-foreground">
                    先去「人才市场」创建 Agent
                  </p>
                )}
              </div>
            </ScrollArea>
            <p className="mt-1 text-[10px] text-muted-foreground">
              已选 {selectedIds.length} 位成员
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              {initial ? "保存" : "创建"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface GroupChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function GroupChatPanel({ open, onClose }: GroupChatPanelProps) {
  const gc = useGroupChat();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<GroupChannel | null>(
    null
  );

  const openCreate = useCallback(() => {
    setEditingChannel(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback(() => {
    setEditingChannel(gc.selectedChannel);
    setModalOpen(true);
  }, [gc.selectedChannel]);

  const handleSave = useCallback(
    (name: string, agentIds: string[], avatar: string) => {
      if (editingChannel) {
        gc.editChannel(editingChannel.id, { name, agentIds, avatar });
      } else {
        gc.createChannel(name, agentIds, avatar);
      }
    },
    [editingChannel, gc]
  );

  const handleDelete = useCallback(() => {
    if (gc.selectedId) gc.removeChannel(gc.selectedId);
  }, [gc]);

  const handleClear = useCallback(() => {
    if (gc.selectedId) gc.clearChannelMessages(gc.selectedId);
  }, [gc]);

  return (
    <>
      {/* Floating panel — expands downward from the toolbar */}
      <div
        className={cn(
          "absolute left-0 right-0 top-full mt-1.5 z-50",
          "rounded-2xl border border-[#e9e9e9]",
          "bg-white/96 dark:bg-zinc-900/96 backdrop-blur-md",
          "shadow-lg shadow-black/10",
          "flex overflow-hidden",
          "transition-all duration-250 origin-top",
          open
            ? "opacity-100 scale-y-100 pointer-events-auto"
            : "opacity-0 scale-y-0 pointer-events-none"
        )}
        style={{ height: GROUP_CHAT_PANEL_HEIGHT }}
        // Prevent toolbar drag-region from applying to panel
        data-tauri-drag-region={false}
      >
        {/* Close button — top-right corner */}
        <button
          className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-muted/60 hover:bg-muted transition-colors"
          onClick={onClose}
          title="关闭群聊"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <X className="size-2.5 text-muted-foreground" />
        </button>

        {/* Channel sidebar */}
        <ChannelSidebar
          channels={gc.channels}
          selectedId={gc.selectedId}
          onSelect={gc.selectChannel}
          onNew={openCreate}
        />

        {/* Chat area */}
        <ChatArea
          channel={gc.selectedChannel ?? null}
          messages={gc.messages}
          selectedAgents={gc.selectedAgents}
          allAgents={gc.agents}
          isSending={gc.isSending}
          streamingIds={gc.streamingIds}
          onSend={gc.sendMessage}
          onStop={gc.stopGeneration}
          onEdit={openEdit}
          onDelete={handleDelete}
          onClear={handleClear}
        />
      </div>

      {/* Create / Edit channel modal */}
      <ChannelModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initial={editingChannel}
        allAgents={gc.agents}
        onSave={handleSave}
      />
    </>
  );
}
