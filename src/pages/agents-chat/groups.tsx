import { useState, useRef, useEffect, useMemo } from "react";
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  ScrollArea,
  Textarea,
} from "@/components/ui";
import { Markdown } from "@/components";
import {
  Hash,
  Plus,
  Send,
  Trash2,
  Users,
  Pencil,
  Square,
  UserIcon,
  MessageSquarePlus,
} from "lucide-react";
import moment from "moment";
import { useGroupChat } from "@/hooks/useGroupChat";
import type { GroupChannel, GroupMessage, AgentDefinition } from "@/types";

// ─── Avatar helper ────────────────────────────────────────────────────────────

function Avatar({
  src,
  name,
  size = 8,
  className = "",
}: {
  src?: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  const bg = src?.startsWith("/") || src?.startsWith("http");
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden ${className}`}
      style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
    >
      {bg ? (
        <img src={src} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : (
        <span style={{ fontSize: `${size * 1.8}px` }}>{src || name?.[0] || "?"}</span>
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
    <div className="flex w-64 flex-shrink-0 flex-col border-r bg-muted/20">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          群组频道
        </span>
        <Button size="icon" variant="ghost" className="size-6" onClick={onNew} title="新建频道">
          <Plus className="size-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {channels.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              还没有频道<br />点击 + 新建
            </p>
          )}
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => onSelect(ch.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-left ${
                selectedId === ch.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Hash className="size-3.5 flex-shrink-0" />
              <span className="flex-1 truncate">{ch.name}</span>
              <span className="text-[10px] text-muted-foreground/60">{ch.agentIds.length}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Message bubble ────────────────────────────────────────────────────────────

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
  const displayName = isUser ? "You" : (agentDef?.name ?? msg.agentName ?? "Agent");

  return (
    <div className={`group flex gap-3 px-4 ${showHeader ? "mt-4" : "mt-0.5 pl-[52px]"}`}>
      {showHeader && (
        <div className="mt-0.5 flex-shrink-0">
          {isUser ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
              <UserIcon className="size-4 text-primary-foreground" />
            </div>
          ) : (
            <Avatar src={avatarSrc} name={displayName} size={9} />
          )}
        </div>
      )}

      <div className="flex-1 min-w-0">
        {showHeader && (
          <div className="mb-0.5 flex items-baseline gap-2">
            <span className={`text-sm font-semibold ${isUser ? "text-primary" : ""}`}>
              {displayName}
            </span>
            {!isUser && agentDef?.role && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                {agentDef.role}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">
              {moment(msg.timestamp).format("HH:mm")}
            </span>
          </div>
        )}
        <div className={`text-sm leading-relaxed ${isStreaming ? "text-muted-foreground" : ""}`}>
          {msg.content ? (
            <Markdown>{msg.content}</Markdown>
          ) : isStreaming ? (
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
              <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
              <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Chat panel ────────────────────────────────────────────────────────────────

function ChatPanel({
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const submit = () => {
    if (!input.trim() || isSending) return;
    onSend(input.trim());
    setInput("");
  };

  if (!channel) {
    return (
      <div className="flex flex-1 items-center justify-center flex-col gap-3 text-muted-foreground">
        <MessageSquarePlus className="size-10 opacity-30" />
        <p className="text-sm">选择或新建一个频道开始群聊</p>
      </div>
    );
  }

  // Build a map of agentId → AgentDefinition for fast lookup
  const agentMap = useMemo(() => {
    const m = new Map<string, AgentDefinition>();
    allAgents.forEach((a) => m.set(a.id, a));
    return m;
  }, [allAgents]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Channel header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Hash className="size-4 text-muted-foreground" />
        <span className="font-semibold">{channel.name}</span>
        <div className="ml-2 flex -space-x-2">
          {selectedAgents.slice(0, 5).map((a) => (
            <Avatar key={a.id} src={a.avatar} name={a.name} size={6} className="ring-1 ring-background" />
          ))}
          {selectedAgents.length > 5 && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted ring-1 ring-background text-[10px]">
              +{selectedAgents.length - 5}
            </div>
          )}
        </div>
        <span className="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="size-3" />{selectedAgents.length} 位成员
        </span>
        <div className="ml-auto flex gap-1">
          <Button size="icon" variant="ghost" className="size-7" title="编辑频道" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7" title="清空消息" onClick={onClear}>
            <Square className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7 text-destructive/70 hover:text-destructive" title="删除频道" onClick={onDelete}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 py-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
            <Hash className="size-8 opacity-30" />
            <p className="text-sm">发送第一条消息，启动群聊</p>
            {selectedAgents.length > 0 && (
              <p className="text-xs opacity-60">
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
              moment(msg.timestamp).diff(moment(prev.timestamp), "minutes") > 5;
            return (
              <MessageRow
                key={msg.id}
                msg={msg}
                isStreaming={streamingIds.has(msg.id)}
                showHeader={showHeader}
                agentDef={msg.agentId ? agentMap.get(msg.agentId) : undefined}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3">
        {selectedAgents.length === 0 && (
          <p className="mb-2 text-xs text-amber-500">
            该频道还没有成员，请先编辑频道添加 Agent。
          </p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            className="flex-1 resize-none min-h-[40px] max-h-32 py-2"
            placeholder={`发消息到 #${channel.name}… (可用 @姓名 点名)`}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending || selectedAgents.length === 0}
          />
          {isSending ? (
            <Button size="icon" variant="outline" onClick={onStop} title="停止生成">
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={submit}
              disabled={!input.trim() || selectedAgents.length === 0}
              title="发送 (Enter)"
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Enter 发送 · Shift+Enter 换行 · @姓名 点名
        </p>
      </div>
    </div>
  );
}

// ─── Create / Edit Channel Modal ───────────────────────────────────────────────

const CHANNEL_AVATARS = ["💬", "🔥", "🚀", "💡", "🎯", "📣", "🛠️", "🎨", "📊", "🤝", "⚡", "🌐"];

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
  const [name, setName] = useState(initial?.name ?? "");
  const [avatar, setAvatar] = useState(initial?.avatar ?? "💬");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(initial?.agentIds ?? []);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setAvatar(initial?.avatar ?? "💬");
      setSelectedAgentIds(initial?.agentIds ?? []);
      setShowAvatarPicker(false);
    }
  }, [open, initial]);

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), selectedAgentIds, avatar);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑频道" : "新建频道"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-muted text-2xl hover:ring-2 hover:ring-primary/50 transition-all"
              onClick={() => setShowAvatarPicker((v) => !v)}
              title="选择图标"
            >
              {avatar}
            </button>
            <div className="flex-1">
              <Label className="mb-1 block text-xs">频道名称 *</Label>
              <Input value={name} placeholder="general" onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          {showAvatarPicker && (
            <div className="flex flex-wrap gap-1.5 rounded-lg border bg-muted/30 p-2">
              {CHANNEL_AVATARS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-accent ${avatar === e ? "ring-2 ring-primary bg-accent" : ""}`}
                  onClick={() => { setAvatar(e); setShowAvatarPicker(false); }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          <div>
            <Label className="mb-2 block text-xs">选择成员（可多选）</Label>
            <ScrollArea className="h-56 rounded-md border">
              <div className="grid grid-cols-1 gap-1 p-2">
                {allAgents.map((agent) => {
                  const selected = selectedAgentIds.includes(agent.id);
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => toggleAgent(agent.id)}
                      className={`flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors ${
                        selected ? "bg-primary/10 text-primary" : "hover:bg-accent"
                      }`}
                    >
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden">
                        {agent.avatar?.startsWith("/") || agent.avatar?.startsWith("http") ? (
                          <img src={agent.avatar} alt={agent.name} className="h-full w-full object-cover" />
                        ) : (
                          <span>{agent.avatar || "🤖"}</span>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">{agent.name}</div>
                        {agent.role && (
                          <div className="text-[11px] text-muted-foreground">{agent.role}</div>
                        )}
                      </div>
                      {selected && <span className="text-primary text-xs">✓</span>}
                    </button>
                  );
                })}
                {allAgents.length === 0 && (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    先去「人才市场」创建 Agent
                  </p>
                )}
              </div>
            </ScrollArea>
            <p className="mt-1 text-xs text-muted-foreground">
              已选 {selectedAgentIds.length} 位成员
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              {initial ? "保存" : "创建"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

const Groups = () => {
  const gc = useGroupChat();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<GroupChannel | null>(null);

  const openCreate = () => { setEditingChannel(null); setModalOpen(true); };
  const openEdit = () => { setEditingChannel(gc.selectedChannel); setModalOpen(true); };

  const handleSave = (name: string, agentIds: string[], avatar: string) => {
    if (editingChannel) {
      gc.editChannel(editingChannel.id, { name, agentIds, avatar });
    } else {
      gc.createChannel(name, agentIds, avatar);
    }
  };

  const handleDelete = () => {
    if (gc.selectedId) gc.removeChannel(gc.selectedId);
  };

  const handleClear = () => {
    if (gc.selectedId) gc.clearChannelMessages(gc.selectedId);
  };

  return (
    <div className="flex h-full overflow-hidden">
      <ChannelSidebar
        channels={gc.channels}
        selectedId={gc.selectedId}
        onSelect={gc.selectChannel}
        onNew={openCreate}
      />

      <ChatPanel
        channel={gc.selectedChannel}
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

      <ChannelModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initial={editingChannel}
        allAgents={gc.agents}
        onSave={handleSave}
      />
    </div>
  );
};

export default Groups;
