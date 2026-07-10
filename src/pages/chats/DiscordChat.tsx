/**
 * DiscordChat — unified, Discord/Driod-style 3-panel chat interface.
 *
 * Panels:
 *  ① SectionRail (64 px)  — section icons: AI对话 / 群组 / 会议 / 智能体
 *  ② ChannelSidebar (240 px) — channel list for the active section
 *  ③ ContentArea (flex-1)  — messages, group chat, meeting detail, agents
 */

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  MessageSquare,
  Users,
  Brain,
  Bot,
  Plus,
  Search,
  Hash,
  Pencil,
  Trash2,
  Square,
  Send,
  UserIcon,
  CheckCircle2,
  Sparkles,
  BookOpen,
  Target,
} from "lucide-react";
import moment from "moment";
import { cn } from "@/lib/utils";
import {
  Button,
  Badge,
  Input,
  Label,
  Textarea,
  ScrollArea,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/components/ui";
import { Markdown, Empty } from "@/components";

// hooks & data
import { useGroupChat } from "@/hooks/useGroupChat";
import { useAgents } from "@/hooks/useAgents";
import { useHistory } from "@/hooks/useHistory";
import { useChatCompletion } from "@/hooks/useChatCompletion";
import { useApp } from "@/contexts";
import {
  getRecentMeetingSummaries,
  deleteMeetingSummary,
} from "@/lib/database";
import {
  getConversationById,
  deleteConversation,
} from "@/lib";

import type {
  GroupChannel,
  AgentDefinition,
  MeetingSummary,
  SandboxMode,
} from "@/types";
import { useSkillStore } from "@/store";

// ─── Section definitions ──────────────────────────────────────────────────────

type Section = "ai" | "groups" | "meetings" | "agents";

interface SectionDef {
  id: Section;
  icon: React.ElementType;
  label: string;
  color: string;
  activeColor: string;
}

const SECTIONS: SectionDef[] = [
  { id: "ai",       icon: MessageSquare, label: "AI 对话",  color: "text-blue-500",   activeColor: "bg-blue-500/10 text-blue-600 border-blue-200" },
  { id: "groups",   icon: Users,         label: "群组聊天", color: "text-violet-500", activeColor: "bg-violet-500/10 text-violet-600 border-violet-200" },
  { id: "meetings", icon: Brain,         label: "会议记录", color: "text-emerald-500",activeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  { id: "agents",   icon: Bot,           label: "智能体",   color: "text-amber-500",  activeColor: "bg-amber-500/10 text-amber-600 border-amber-200" },
];

// ─── Avatar helper ────────────────────────────────────────────────────────────

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
  const isImg = src?.startsWith("/") || src?.startsWith("http");
  return (
    <div
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden",
        className
      )}
      style={{ width: size * 4, height: size * 4 }}
    >
      {isImg ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span style={{ fontSize: size * 1.8 }}>{src || name?.[0] || "?"}</span>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ① SECTION RAIL
// ════════════════════════════════════════════════════════════════════════════

function SectionRail({
  active,
  onSelect,
}: {
  active: Section;
  onSelect: (s: Section) => void;
}) {
  return (
    <div className="flex w-16 flex-shrink-0 flex-col items-center gap-1 border-r bg-muted/30 py-4">
      {SECTIONS.map((s) => {
        const Icon = s.icon;
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            title={s.label}
            onClick={() => onSelect(s.id)}
            className={cn(
              "flex h-10 w-10 flex-col items-center justify-center gap-0.5 rounded-xl border transition-all duration-150",
              isActive
                ? s.activeColor + " border"
                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            <span className="text-[8px] font-medium leading-none">
              {s.label.slice(0, 2)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ② CHANNEL SIDEBARS
// ════════════════════════════════════════════════════════════════════════════

// ── AI Conversations channel list ─────────────────────────────────────────

function AIChannelList({
  selectedId,
  onSelect,
  onNew,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const { conversations, search, setSearch, isLoading } = useHistory();
  const sorted = useMemo(() => [...conversations].sort(
    (a, b) => b.updatedAt - a.updatedAt
  ), [conversations]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          对话历史
        </span>
        <Button size="icon" variant="ghost" className="size-6" onClick={onNew} title="新建对话">
          <Plus className="size-3.5" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-2 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索对话…"
            className="pl-7 h-7 text-xs"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 px-2 pb-4">
          {isLoading && (
            <p className="py-6 text-center text-xs text-muted-foreground">加载中…</p>
          )}
          {!isLoading && sorted.length === 0 && (
            <p className="py-6 text-center text-[11px] text-muted-foreground">
              还没有对话记录
            </p>
          )}
          {sorted
            .filter((c) =>
              search.trim()
                ? c.title.toLowerCase().includes(search.toLowerCase())
                : true
            )
            .map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "w-full rounded-lg px-2 py-2 text-left transition-colors",
                  selectedId === conv.id
                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="mt-0.5 size-3 flex-shrink-0 opacity-60" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{conv.title || "Untitled"}</p>
                    <p className="text-[10px] opacity-60">
                      {conv.messages.length} 条 · {moment(conv.updatedAt).fromNow()}
                    </p>
                  </div>
                </div>
              </button>
            ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Group channel list ─────────────────────────────────────────────────────

function GroupChannelList({
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
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          群组频道
        </span>
        <Button size="icon" variant="ghost" className="size-6" onClick={onNew} title="新建频道">
          <Plus className="size-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 px-2 pb-4">
          {channels.length === 0 && (
            <p className="py-6 text-center text-[11px] text-muted-foreground">
              还没有群组<br />点击 + 新建
            </p>
          )}
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => onSelect(ch.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors",
                selectedId === ch.id
                  ? "bg-violet-500/10 text-violet-700 dark:text-violet-300 font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className="text-base leading-none">{ch.avatar ?? "💬"}</span>
              <span className="flex-1 truncate">{ch.name}</span>
              <span className="text-[10px] opacity-50">{ch.agentIds.length}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Meeting channel list ───────────────────────────────────────────────────

function MeetingChannelList({
  meetings,
  selectedId,
  onSelect,
  loading,
}: {
  meetings: MeetingSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="px-3 pt-3 pb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          会议记录
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 px-2 pb-4">
          {loading && (
            <p className="py-6 text-center text-xs text-muted-foreground">加载中…</p>
          )}
          {!loading && meetings.length === 0 && (
            <p className="py-6 text-center text-[11px] text-muted-foreground">
              还没有会议记录
            </p>
          )}
          {meetings.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={cn(
                "w-full rounded-lg px-2 py-2 text-left transition-colors",
                selectedId === m.id
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-start gap-2">
                <Brain className="mt-0.5 size-3 flex-shrink-0 opacity-60" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">
                    {m.title || `会议 ${moment(m.createdAt).format("MM/DD")}`}
                  </p>
                  <p className="text-[10px] opacity-60">
                    {m.topics.slice(0, 2).join(" · ") || moment(m.createdAt).fromNow()}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Agent list ─────────────────────────────────────────────────────────────

function AgentChannelList({
  agents,
  selectedId,
  onSelect,
  onNew,
}: {
  agents: AgentDefinition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = agents.filter(
    (a) =>
      !search.trim() ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.role ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          智能体
        </span>
        <Button size="icon" variant="ghost" className="size-6" onClick={onNew} title="新建智能体">
          <Plus className="size-3.5" />
        </Button>
      </div>

      <div className="px-2 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索智能体…"
            className="pl-7 h-7 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 px-2 pb-4">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-[11px] text-muted-foreground">
              {agents.length === 0 ? "还没有智能体" : "没有匹配的智能体"}
            </p>
          )}
          {filtered.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onSelect(agent.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors",
                selectedId === agent.id
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden text-sm">
                {agent.avatar?.startsWith("/") || agent.avatar?.startsWith("http") ? (
                  <img src={agent.avatar} alt={agent.name} className="h-full w-full object-cover" />
                ) : (
                  <span>{agent.avatar || "🤖"}</span>
                )}
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate font-medium">{agent.name}</p>
                {agent.role && (
                  <p className="text-[10px] opacity-60 truncate">{agent.role}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ③ CONTENT PANELS
// ════════════════════════════════════════════════════════════════════════════

// ── Empty / welcome ────────────────────────────────────────────────────────

function WelcomePane({ section }: { section: Section }) {
  const def = SECTIONS.find((s) => s.id === section)!;
  const Icon = def.icon;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
      <Icon className="size-12 opacity-20" />
      <div className="text-center">
        <p className="text-sm font-medium">选择左侧{def.label}频道</p>
        <p className="text-xs opacity-60 mt-1">或点击 + 新建</p>
      </div>
    </div>
  );
}

// ── AI Chat Panel (inline conversation view) ──────────────────────────────

function AIChatPanel({
  conversationId,
  onDelete,
}: {
  conversationId: string;
  onDelete: () => void;
}) {
  const [messages, setMessages] = useState<any | null>(null);

  const completion = useChatCompletion(conversationId, messages, setMessages);

  useEffect(() => {
    getConversationById(conversationId).then((c) => setMessages(c || null));
  }, [conversationId]);

  useEffect(() => {
    if (messages?.messages.length) {
      setTimeout(() => {
        completion.messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages?.messages.length]);

  if (!messages) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        加载中…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b px-5 py-3">
        <MessageSquare className="size-4 text-muted-foreground" />
        <span className="font-semibold text-sm truncate flex-1">
          {messages.title || "Untitled"}
        </span>
        <Badge variant="outline" className="text-xs">
          {messages.messages.length} 条消息
        </Badge>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-destructive/70 hover:text-destructive gap-1"
          onClick={async () => {
            await deleteConversation(conversationId);
            onDelete();
          }}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 px-5 py-4 pb-24">
          {messages.messages.length === 0 ? (
            <Empty
              isLoading={false}
              icon={MessageSquare}
              title="暂无消息"
              description="发送第一条消息开始对话"
            />
          ) : (
            messages.messages.map((msg: any, i: number, arr: any[]) => {
              const isUser = msg.role === "user";
              const showDate =
                i === 0 ||
                moment(msg.timestamp).format("YYYY-MM-DD") !==
                  moment(arr[i - 1]?.timestamp).format("YYYY-MM-DD");

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] text-muted-foreground px-2">
                        {moment(msg.timestamp).format("YYYY年 MM月DD日")}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
                    {!isUser && (
                      <div className="flex-shrink-0 mt-1">
                        <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <Sparkles className="size-3 text-primary" />
                        </div>
                      </div>
                    )}
                    <div
                      className={cn(
                        "flex max-w-[72%] flex-col gap-1",
                        isUser ? "items-end" : "items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2 text-sm",
                          isUser
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted/60 rounded-tl-sm"
                        )}
                      >
                        <Markdown>{msg.content}</Markdown>
                      </div>
                      <span className="text-[10px] text-muted-foreground px-1">
                        {moment(msg.timestamp).format("HH:mm")}
                      </span>
                    </div>
                    {isUser && (
                      <div className="flex-shrink-0 mt-1">
                        <div className="size-7 rounded-full bg-primary flex items-center justify-center">
                          <UserIcon className="size-3 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={completion.messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="flex-shrink-0 border-t bg-background px-5 py-3">
        {completion.error && (
          <p className="mb-2 text-xs text-destructive">{completion.error}</p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            ref={completion.inputRef}
            className="flex-1 resize-none min-h-[40px] max-h-32 text-sm"
            placeholder="继续对话… (Enter 发送)"
            rows={1}
            value={completion.input}
            onChange={(e) => completion.setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                completion.submit();
              }
            }}
            disabled={completion.isLoading}
          />
          {completion.isLoading ? (
            <Button
              size="icon"
              variant="outline"
              className="size-10"
              onClick={completion.cancel}
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="size-10"
              onClick={() => completion.submit()}
              disabled={!completion.input.trim()}
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Group chat content ─────────────────────────────────────────────────────

function GroupChatContent({
  gc,
  onEditChannel,
  onDeleteChannel,
}: {
  gc: ReturnType<typeof useGroupChat>;
  onEditChannel: () => void;
  onDeleteChannel: () => void;
}) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channel = gc.selectedChannel;
  const messages = gc.messages;

  const agentMap = useMemo(() => {
    const m = new Map<string, AgentDefinition>();
    gc.agents.forEach((a) => m.set(a.id, a));
    return m;
  }, [gc.agents]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, gc.streamingIds.size]);

  const submit = () => {
    if (!input.trim() || gc.isSending) return;
    gc.sendMessage(input.trim());
    setInput("");
  };

  if (!channel) return <WelcomePane section="groups" />;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Channel header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b px-5 py-3">
        <span className="text-xl">{channel.avatar ?? "💬"}</span>
        <span className="font-semibold text-sm">{channel.name}</span>

        {/* Member avatars */}
        <div className="flex -space-x-2 ml-1">
          {gc.selectedAgents.slice(0, 5).map((a) => (
            <Avatar key={a.id} src={a.avatar} name={a.name} size={6}
              className="ring-2 ring-background" />
          ))}
          {gc.selectedAgents.length > 5 && (
            <div className="flex size-6 items-center justify-center rounded-full bg-muted ring-2 ring-background text-[9px]">
              +{gc.selectedAgents.length - 5}
            </div>
          )}
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Users className="size-3" />{gc.selectedAgents.length} 位成员
        </span>

        <div className="ml-auto flex gap-1">
          <Button size="icon" variant="ghost" className="size-7" onClick={onEditChannel}>
            <Pencil className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7" onClick={() => gc.clearChannelMessages(channel.id)}>
            <Square className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost"
            className="size-7 text-destructive/60 hover:text-destructive"
            onClick={onDeleteChannel}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Hash className="size-10 opacity-20" />
            <p className="text-sm">发送第一条消息，启动群聊</p>
            {gc.selectedAgents.length === 0 && (
              <p className="text-xs opacity-60">请先编辑频道，添加 Agent 成员</p>
            )}
          </div>
        ) : (
          <div className="py-2">
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const showHeader =
                i === 0 ||
                prev.role !== msg.role ||
                (msg.role === "agent" && prev.agentId !== msg.agentId) ||
                moment(msg.timestamp).diff(moment(prev.timestamp), "minutes") > 5;

              const isUser = msg.role === "user";
              const agentDef = msg.agentId ? agentMap.get(msg.agentId) : undefined;
              const displayName = isUser ? "You" : agentDef?.name ?? msg.agentName ?? "Agent";
              const avatarSrc = isUser ? undefined : agentDef?.avatar ?? msg.agentAvatar;
              const isStreaming = gc.streamingIds.has(msg.id);

              return (
                <div key={msg.id}
                  className={cn("flex gap-3 px-5", showHeader ? "mt-5" : "mt-0.5 pl-[68px]")}
                >
                  {showHeader && (
                    <div className="mt-0.5 flex-shrink-0">
                      {isUser ? (
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary">
                          <UserIcon className="size-4 text-primary-foreground" />
                        </div>
                      ) : (
                        <Avatar src={avatarSrc} name={displayName} size={9} />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {showHeader && (
                      <div className="mb-1 flex items-baseline gap-2">
                        <span className={cn("text-sm font-semibold", isUser ? "text-primary" : "")}>
                          {displayName}
                        </span>
                        {!isUser && agentDef?.role && (
                          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                            {agentDef.role}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {moment(msg.timestamp).format("HH:mm")}
                        </span>
                      </div>
                    )}
                    <div className={cn("text-sm leading-relaxed", isStreaming && !msg.content ? "text-muted-foreground" : "")}>
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
            })}
            <div ref={messagesEndRef} className="h-2" />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="flex-shrink-0 border-t px-5 py-3">
        {gc.selectedAgents.length === 0 && (
          <p className="mb-2 text-xs text-amber-500 flex items-center gap-1">
            <span>⚠</span> 该频道还没有成员，请先编辑频道添加 Agent。
          </p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            className="flex-1 resize-none min-h-[40px] max-h-32 text-sm"
            placeholder={`发消息到 ${channel.avatar ?? "#"}${channel.name}… (@姓名 点名)`}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={gc.isSending || gc.selectedAgents.length === 0}
          />
          {gc.isSending ? (
            <Button size="icon" variant="outline" className="size-10" onClick={gc.stopGeneration}>
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="size-10"
              onClick={submit}
              disabled={!input.trim() || gc.selectedAgents.length === 0}
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Enter 发送 · Shift+Enter 换行 · @姓名 点名特定 Agent
        </p>
      </div>
    </div>
  );
}

// ── Meeting detail ─────────────────────────────────────────────────────────

function MeetingDetail({
  meeting,
  onDelete,
}: {
  meeting: MeetingSummary;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b px-5 py-3">
        <Brain className="size-4 text-muted-foreground" />
        <span className="font-semibold text-sm truncate flex-1">
          {meeting.title || `会议 ${moment(meeting.createdAt).format("MM/DD HH:mm")}`}
        </span>
        {meeting.durationSeconds && (
          <Badge variant="outline" className="text-xs">
            {Math.round(meeting.durationSeconds / 60)} 分钟
          </Badge>
        )}
        <Badge variant="outline" className="text-xs">
          {meeting.exchangeCount} 轮
        </Badge>
        <Button
          size="sm" variant="ghost"
          className="h-7 text-xs text-destructive/70 hover:text-destructive gap-1"
          onClick={async () => {
            await deleteMeetingSummary(meeting.id);
            onDelete();
          }}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-5 px-5 py-5">
          {/* Summary */}
          {meeting.summary && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <BookOpen className="size-3.5" /> 摘要
              </h3>
              <p className="text-sm leading-relaxed">{meeting.summary}</p>
            </section>
          )}

          {/* Topics */}
          {meeting.topics.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Hash className="size-3.5" /> 主题
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {meeting.topics.map((t, i) => (
                  <Badge key={i} variant="secondary">{t}</Badge>
                ))}
              </div>
            </section>
          )}

          {/* Goals */}
          {meeting.goals.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Target className="size-3.5" /> 目标
              </h3>
              <ul className="space-y-1">
                {meeting.goals.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1 text-primary">•</span>{g}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Action items */}
          {meeting.actionItems.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <CheckCircle2 className="size-3.5" /> 行动项
              </h3>
              <ul className="space-y-1">
                {meeting.actionItems.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 size-3.5 flex-shrink-0 text-emerald-500" />{a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Decisions */}
          {meeting.decisions.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="size-3.5" /> 决策
              </h3>
              <ul className="space-y-1">
                {meeting.decisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1 text-violet-500">→</span>{d}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Participants */}
          {meeting.participants.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Users className="size-3.5" /> 参与者
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {meeting.participants.map((p, i) => (
                  <Badge key={i} variant="outline">{p}</Badge>
                ))}
              </div>
            </section>
          )}

          <p className="text-xs text-muted-foreground">
            记录于 {moment(meeting.createdAt).format("YYYY年MM月DD日 HH:mm")}
          </p>
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Agent detail / edit panel ──────────────────────────────────────────────

const SANDBOX_MODES: { value: SandboxMode; label: string }[] = [
  { value: "read-only", label: "只读" },
  { value: "workspace-write", label: "工作区可写" },
  { value: "danger-full-access", label: "完全访问" },
];

// All cartoon/talent avatar images from public/talent_icon/
const TALENT_ICONS: string[] = [
  "/talent_icon/adjusted_avatar_004.png.jpeg",
  "/talent_icon/cartoon_avatar_002.png.jpeg",
  "/talent_icon/cartoon_avatar_003.png.jpeg",
  "/talent_icon/cartoon_avatar_005.png.jpeg",
  "/talent_icon/cartoon_avatar_006.png.jpeg",
  "/talent_icon/cartoon_avatar_007.png.jpeg",
  "/talent_icon/cartoon_avatar_008.png.jpeg",
  "/talent_icon/cartoon_avatar_009.png.jpeg",
  "/talent_icon/cartoon_avatar_010.png.jpeg",
  "/talent_icon/cartoon_avatar_011.png.jpeg",
  "/talent_icon/cartoon_avatar_012.png.jpeg",
  "/talent_icon/cartoon_avatar_013.png.jpeg",
  "/talent_icon/cartoon_avatar_014.png.jpeg",
  "/talent_icon/cartoon_avatar_016.png.jpeg",
  "/talent_icon/cartoon_avatar_017.png.jpeg",
  "/talent_icon/cartoon_avatar_018.png.jpeg",
  "/talent_icon/cartoon_avatar_021.png.jpeg",
  "/talent_icon/cartoon_avatar_022.png.jpeg",
  "/talent_icon/cartoon_avatar_023.png.jpeg",
  "/talent_icon/cartoon_avatar_025.png.jpeg",
  "/talent_icon/cartoon_avatar_027.png.jpeg",
  "/talent_icon/cartoon_avatar_028.png.jpeg",
  "/talent_icon/cartoon_avatar_029.png.jpeg",
  "/talent_icon/cartoon_avatar_030.png.jpeg",
  "/talent_icon/cartoon_avatar_031.png.jpeg",
  "/talent_icon/cartoon_avatar_032.png.jpeg",
  "/talent_icon/cartoon_avatar_033.png.jpeg",
  "/talent_icon/cartoon_avatar_034.png.jpeg",
  "/talent_icon/cartoon_avatar_036.png.jpeg",
  "/talent_icon/centered_avatar_002.png.jpeg",
  "/talent_icon/focused_avatar_001.png.jpeg",
  "/talent_icon/focused_avatar_002.png.jpeg",
  "/talent_icon/more_avatar_001.png.jpeg",
  "/talent_icon/more_avatar_005.png.jpeg",
  "/talent_icon/more_avatar_012.png.jpeg",
  "/talent_icon/more_avatar_014.png.jpeg",
  "/talent_icon/varied_avatar_001.png.jpeg",
];

type AgentDraft = Omit<AgentDefinition, "id" | "createdAt" | "updatedAt">;

function AgentDetail({
  agent,
  onSave,
  onDelete,
  onClose,
}: {
  agent: AgentDefinition | null;
  onSave: (draft: AgentDraft, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const { allAiProviders } = useApp();
  const { items: skills } = useSkillStore();

  const blankDraft = (): AgentDraft => ({
    name: "",
    description: "",
    role: "",
    avatar: "🤖",
    systemPrompt: "",
    providerId: "",
    modelId: "",
    enabledInternalTools: [],
    enabledSkillIds: [],
    enabledMcpServerIds: [],
    sandboxMode: "read-only",
    temperature: 0.7,
    maxTokens: 4096,
    workspacePath: "",
  });

  const [draft, setDraft] = useState<AgentDraft>(
    agent ? {
      name: agent.name,
      description: agent.description ?? "",
      role: agent.role ?? "",
      avatar: agent.avatar ?? "🤖",
      systemPrompt: agent.systemPrompt,
      providerId: agent.providerId,
      modelId: agent.modelId,
      enabledInternalTools: agent.enabledInternalTools,
      enabledSkillIds: agent.enabledSkillIds,
      enabledMcpServerIds: agent.enabledMcpServerIds,
      sandboxMode: agent.sandboxMode,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      workspacePath: agent.workspacePath,
    } : blankDraft()
  );
  const [saving, setSaving] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  useEffect(() => {
    if (agent) {
      setDraft({
        name: agent.name,
        description: agent.description ?? "",
        role: agent.role ?? "",
        avatar: agent.avatar ?? "🤖",
        systemPrompt: agent.systemPrompt,
        providerId: agent.providerId,
        modelId: agent.modelId,
        enabledInternalTools: agent.enabledInternalTools,
        enabledSkillIds: agent.enabledSkillIds,
        enabledMcpServerIds: agent.enabledMcpServerIds,
        sandboxMode: agent.sandboxMode,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        workspacePath: agent.workspacePath,
      });
    } else {
      setDraft(blankDraft());
    }
    setShowAvatarPicker(false);
  }, [agent?.id]);

  const handleSave = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      await onSave(draft, agent?.id);
    } finally {
      setSaving(false);
    }
  };

  const toggleSkill = (id: string) => {
    setDraft((d) => ({
      ...d,
      enabledSkillIds: d.enabledSkillIds.includes(id)
        ? d.enabledSkillIds.filter((x) => x !== id)
        : [...d.enabledSkillIds, id],
    }));
  };

  const selectedProvider = allAiProviders.find((p) => p.id === draft.providerId);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b px-5 py-3">
        <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden text-lg">
          {draft.avatar?.startsWith("/") ? (
            <img src={draft.avatar} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            draft.avatar
          )}
        </div>
        <span className="font-semibold text-sm flex-1">
          {agent ? `编辑 ${agent.name}` : "新建智能体"}
        </span>
        {agent && (
          <Button
            size="sm" variant="ghost"
            className="h-7 text-xs text-destructive/70 hover:text-destructive gap-1"
            onClick={async () => {
              await onDelete(agent.id);
              onClose();
            }}
          >
            <Trash2 className="size-3" /> 删除
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onClose}>
          取消
        </Button>
        <Button
          size="sm" className="h-7 text-xs"
          onClick={handleSave}
          disabled={!draft.name.trim() || saving}
        >
          {saving ? "保存中…" : "保存"}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid grid-cols-2 gap-5 px-5 py-5">
          {/* Left column */}
          <div className="flex flex-col gap-4">
            {/* Avatar */}
            <div>
              <Label className="mb-1.5 block text-xs">头像</Label>
              <div className="flex items-center gap-3">
                <button
                  className="flex size-12 items-center justify-center rounded-xl bg-muted overflow-hidden text-2xl hover:ring-2 hover:ring-primary/40 transition-all"
                  onClick={() => setShowAvatarPicker((v) => !v)}
                >
                  {draft.avatar?.startsWith("/") ? (
                    <img src={draft.avatar} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    draft.avatar
                  )}
                </button>
                {showAvatarPicker && (
                  <div className="max-h-48 overflow-y-auto rounded-lg border bg-muted/30 p-2">
                    <div className="grid grid-cols-6 gap-1.5">
                      {TALENT_ICONS.map((src) => (
                        <button
                          key={src}
                          className={cn(
                            "overflow-hidden rounded-lg transition-all hover:scale-105",
                            draft.avatar === src && "ring-2 ring-primary"
                          )}
                          onClick={() => { setDraft(d => ({ ...d, avatar: src })); setShowAvatarPicker(false); }}
                        >
                          <img src={src} alt="avatar" className="h-10 w-10 object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Name */}
            <div>
              <Label className="mb-1.5 block text-xs">名称 *</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="智能体名称"
                className="h-8 text-sm"
              />
            </div>

            {/* Role */}
            <div>
              <Label className="mb-1.5 block text-xs">角色 / 职称</Label>
              <Input
                value={draft.role}
                onChange={(e) => setDraft(d => ({ ...d, role: e.target.value }))}
                placeholder="前端工程师、市场分析师…"
                className="h-8 text-sm"
              />
            </div>

            {/* Description */}
            <div>
              <Label className="mb-1.5 block text-xs">描述</Label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
                placeholder="一句话介绍这个智能体…"
                className="text-sm min-h-[60px] resize-none"
                rows={2}
              />
            </div>

            {/* Provider */}
            <div>
              <Label className="mb-1.5 block text-xs">AI 提供商</Label>
              <Select
                value={draft.providerId}
                onValueChange={(v) => setDraft(d => ({ ...d, providerId: v, modelId: "" }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="选择提供商" />
                </SelectTrigger>
                <SelectContent>
                  {allAiProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div>
              <Label className="mb-1.5 block text-xs">模型</Label>
              <Input
                value={draft.modelId}
                onChange={(e) => setDraft(d => ({ ...d, modelId: e.target.value }))}
                placeholder={selectedProvider ? `${selectedProvider.name} 模型 ID` : "模型 ID"}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* System prompt */}
            <div>
              <Label className="mb-1.5 block text-xs">系统提示词</Label>
              <Textarea
                value={draft.systemPrompt}
                onChange={(e) => setDraft(d => ({ ...d, systemPrompt: e.target.value }))}
                placeholder="You are a helpful assistant…"
                className="text-sm min-h-[120px] resize-none"
                rows={5}
              />
            </div>

            {/* Temperature */}
            <div>
              <Label className="mb-1.5 block text-xs">温度 ({draft.temperature})</Label>
              <input
                type="range" min={0} max={1} step={0.05}
                value={draft.temperature}
                onChange={(e) => setDraft(d => ({ ...d, temperature: Number(e.target.value) }))}
                className="w-full h-1.5 accent-primary"
              />
            </div>

            {/* Max tokens */}
            <div>
              <Label className="mb-1.5 block text-xs">最大 Token 数</Label>
              <Input
                type="number" min={256} max={32768} step={256}
                value={draft.maxTokens}
                onChange={(e) => setDraft(d => ({ ...d, maxTokens: Number(e.target.value) }))}
                className="h-8 text-sm"
              />
            </div>

            {/* Sandbox mode */}
            <div>
              <Label className="mb-1.5 block text-xs">沙盒模式</Label>
              <Select
                value={draft.sandboxMode}
                onValueChange={(v) => setDraft(d => ({ ...d, sandboxMode: v as SandboxMode }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SANDBOX_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Skills */}
            {skills.length > 0 && (
              <div>
                <Label className="mb-1.5 block text-xs">启用技能</Label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto rounded-md border p-2">
                  {skills.map((sk) => (
                    <label key={sk.id} className="flex cursor-pointer items-center gap-2">
                      <Switch
                        checked={draft.enabledSkillIds.includes(sk.id)}
                        onCheckedChange={() => toggleSkill(sk.id)}
                        className="scale-75"
                      />
                      <span className="text-xs">{sk.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Agent market (card grid) ───────────────────────────────────────────────

function AgentMarket({
  agents,
  onSelect,
  onNew,
}: {
  agents: AgentDefinition[];
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-shrink-0 items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-muted-foreground" />
          <span className="font-semibold text-sm">智能体市场</span>
          <Badge variant="secondary">{agents.length}</Badge>
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={onNew}>
          <Plus className="size-3" /> 新建
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
            <Bot className="size-12 opacity-20" />
            <div className="text-center">
              <p className="text-sm font-medium">还没有智能体</p>
              <p className="text-xs opacity-60 mt-1">创建你的第一个 AI 助手</p>
            </div>
            <Button size="sm" onClick={onNew}>
              <Plus className="size-3.5 mr-1" /> 新建智能体
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-5 xl:grid-cols-3">
            {agents.map((agent) => (
              <Card
                key={agent.id}
                className="cursor-pointer select-none p-4 transition-all hover:shadow-md hover:border-primary/40 group"
                onClick={() => onSelect(agent.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xl overflow-hidden">
                    {agent.avatar?.startsWith("/") || agent.avatar?.startsWith("http") ? (
                      <img src={agent.avatar} alt={agent.name} className="h-full w-full object-cover" />
                    ) : (
                      <span>{agent.avatar || "🤖"}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{agent.name}</p>
                    {agent.role && (
                      <Badge variant="secondary" className="mt-0.5 h-4 px-1.5 text-[10px]">
                        {agent.role}
                      </Badge>
                    )}
                    {agent.description && (
                      <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                        {agent.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {agent.modelId || "—"}
                  </span>
                  <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    点击编辑
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ── Channel create/edit modal ──────────────────────────────────────────────

const CHANNEL_ICONS = [
  "💬","🔥","🚀","💡","🎯","📣","🛠️","🎨","📊","🤝","⚡","🌐","🧪","🏆","🎸","🌙",
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
    setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {initial ? "编辑频道" : "新建频道"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              className="flex size-10 items-center justify-center rounded-lg bg-muted text-xl hover:ring-2 hover:ring-primary/40 transition-all"
              onClick={() => setPickerOpen((v) => !v)}
            >
              {avatar}
            </button>
            <div className="flex-1">
              <Label className="mb-1 block text-[10px]">频道名称 *</Label>
              <Input className="h-8 text-xs" value={name} placeholder="general"
                onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          {pickerOpen && (
            <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-2">
              {CHANNEL_ICONS.map((e) => (
                <button key={e}
                  className={cn("flex size-7 items-center justify-center rounded-md text-base hover:bg-accent transition-colors",
                    avatar === e && "ring-2 ring-primary bg-accent")}
                  onClick={() => { setAvatar(e); setPickerOpen(false); }}
                >{e}</button>
              ))}
            </div>
          )}

          <div>
            <Label className="mb-1.5 block text-[10px]">成员 Agent</Label>
            <ScrollArea className="h-44 rounded-md border">
              <div className="grid gap-0.5 p-1.5">
                {allAgents.map((a) => {
                  const sel = selectedIds.includes(a.id);
                  return (
                    <button key={a.id} type="button" onClick={() => toggle(a.id)}
                      className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                        sel ? "bg-primary/10 text-primary" : "hover:bg-accent")}
                    >
                      <span className="size-6 flex items-center justify-center rounded-full bg-muted text-sm">{a.avatar || "🤖"}</span>
                      <div className="flex-1 text-left">
                        <p className="font-medium">{a.name}</p>
                        {a.role && <p className="text-[10px] text-muted-foreground">{a.role}</p>}
                      </div>
                      {sel && <span className="text-primary text-[10px]">✓</span>}
                    </button>
                  );
                })}
                {allAgents.length === 0 && (
                  <p className="p-3 text-center text-[11px] text-muted-foreground">
                    先去智能体区创建 Agent
                  </p>
                )}
              </div>
            </ScrollArea>
            <p className="mt-1 text-[10px] text-muted-foreground">已选 {selectedIds.length} 位</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>取消</Button>
            <Button size="sm" className="h-7 text-xs" disabled={!name.trim()}
              onClick={() => { onSave(name.trim(), selectedIds, avatar); onOpenChange(false); }}>
              {initial ? "保存" : "创建"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — DiscordChat
// ════════════════════════════════════════════════════════════════════════════

export default function DiscordChat() {
  // ── Section & selection state ─────────────────────────────────────────────
  const [section, setSection] = useState<Section>("ai");
  const [selectedAiId, setSelectedAiId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null); // null = market view
  const [isNewAgent, setIsNewAgent] = useState(false);

  // ── Group chat ────────────────────────────────────────────────────────────
  const gc = useGroupChat();
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<GroupChannel | null>(null);

  // Sync gc selection with our state
  useEffect(() => {
    if (selectedGroupId && selectedGroupId !== gc.selectedId) {
      gc.selectChannel(selectedGroupId);
    }
  }, [selectedGroupId]);

  // ── Meetings ──────────────────────────────────────────────────────────────
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);

  const loadMeetings = useCallback(async () => {
    setMeetingsLoading(true);
    try {
      const m = await getRecentMeetingSummaries(50);
      setMeetings(m);
    } finally {
      setMeetingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section === "meetings") loadMeetings();
  }, [section, loadMeetings]);

  // ── Agents ────────────────────────────────────────────────────────────────
  const { agents, create: createAgent, update: editAgent, remove: removeAgent } = useAgents();

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSaveChannel = useCallback(
    (name: string, agentIds: string[], avatar: string) => {
      if (editingChannel) {
        gc.editChannel(editingChannel.id, { name, agentIds, avatar });
      } else {
        const ch = gc.createChannel(name, agentIds, avatar);
        setSelectedGroupId(ch.id);
      }
    },
    [editingChannel, gc]
  );

  const handleSaveAgent = useCallback(
    async (draft: AgentDraft, id?: string) => {
      if (id) {
        await editAgent(id, draft);
      } else {
        const created = await createAgent(draft as any);
        setSelectedAgentId(created.id);
        setIsNewAgent(false);
      }
    },
    [createAgent, editAgent]
  );

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.id === selectedMeetingId) ?? null,
    [meetings, selectedMeetingId]
  );

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  );

  // ── Content renderer ──────────────────────────────────────────────────────
  const renderContent = () => {
    switch (section) {
      case "ai":
        if (!selectedAiId) return <WelcomePane section="ai" />;
        return (
          <AIChatPanel
            key={selectedAiId}
            conversationId={selectedAiId}
            onDelete={() => setSelectedAiId(null)}
          />
        );

      case "groups":
        if (!selectedGroupId) return <WelcomePane section="groups" />;
        return (
          <GroupChatContent
            gc={gc}
            onEditChannel={() => {
              setEditingChannel(gc.selectedChannel);
              setChannelModalOpen(true);
            }}
            onDeleteChannel={() => {
              if (gc.selectedId) {
                gc.removeChannel(gc.selectedId);
                setSelectedGroupId(null);
              }
            }}
          />
        );

      case "meetings":
        if (!selectedMeeting) return <WelcomePane section="meetings" />;
        return (
          <MeetingDetail
            meeting={selectedMeeting}
            onDelete={() => {
              setSelectedMeetingId(null);
              loadMeetings();
            }}
          />
        );

      case "agents":
        if (selectedAgentId !== null || isNewAgent) {
          return (
            <AgentDetail
              agent={isNewAgent ? null : selectedAgent}
              onSave={handleSaveAgent}
              onDelete={async (id) => {
                await removeAgent(id);
                setSelectedAgentId(null);
                setIsNewAgent(false);
              }}
              onClose={() => {
                setSelectedAgentId(null);
                setIsNewAgent(false);
              }}
            />
          );
        }
        return (
          <AgentMarket
            agents={agents}
            onSelect={(id) => { setSelectedAgentId(id); setIsNewAgent(false); }}
            onNew={() => { setSelectedAgentId(null); setIsNewAgent(true); }}
          />
        );
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ① Section rail */}
      <SectionRail active={section} onSelect={(s) => { setSection(s); }} />

      {/* ② Channel sidebar */}
      <div className="flex w-60 flex-shrink-0 flex-col border-r bg-background overflow-hidden">
        {section === "ai" && (
          <AIChannelList
            selectedId={selectedAiId}
            onSelect={setSelectedAiId}
            onNew={() => {/* navigate to new chat — just deselect */
              setSelectedAiId(null);
            }}
          />
        )}
        {section === "groups" && (
          <GroupChannelList
            channels={gc.channels}
            selectedId={selectedGroupId}
            onSelect={(id) => {
              setSelectedGroupId(id);
              gc.selectChannel(id);
            }}
            onNew={() => {
              setEditingChannel(null);
              setChannelModalOpen(true);
            }}
          />
        )}
        {section === "meetings" && (
          <MeetingChannelList
            meetings={meetings}
            selectedId={selectedMeetingId}
            onSelect={setSelectedMeetingId}
            loading={meetingsLoading}
          />
        )}
        {section === "agents" && (
          <AgentChannelList
            agents={agents}
            selectedId={selectedAgentId}
            onSelect={(id) => { setSelectedAgentId(id); setIsNewAgent(false); }}
            onNew={() => { setSelectedAgentId(null); setIsNewAgent(true); }}
          />
        )}
      </div>

      {/* ③ Main content */}
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        {renderContent()}
      </div>

      {/* Channel modal */}
      <ChannelModal
        open={channelModalOpen}
        onOpenChange={setChannelModalOpen}
        initial={editingChannel}
        allAgents={agents}
        onSave={handleSaveChannel}
      />
    </div>
  );
}
