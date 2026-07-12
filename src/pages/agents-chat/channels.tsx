/**
 * Workstation › Channels
 *
 * Discord-style multi-agent group channels.
 * Left   – Channel list (create / edit / delete)
 * Center – Message stream with agent avatars
 * Right  – (optional) members panel + export to article
 *
 * Export: "导出为文章" button produces a Markdown document
 * that can be downloaded or opened in the Articles page.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button, Dialog, DialogContent, DialogHeader, DialogTitle,
  Input, Label, ScrollArea, Textarea,
} from "@/components/ui";
import { Markdown } from "@/components";
import { useAgents, useGroupChat } from "@/hooks";
import type { GroupChannel, GroupMessage, AgentDefinition } from "@/types";
import {
  Edit2, FileText, Hash, MessageSquare,
  Plus, Send, Square, Trash2, Users, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import moment from "moment";

const CHANNEL_ICONS = ["💬","🔥","🚀","💡","🎯","📣","🛠️","🎨","📊","🤝","⚡","🌐","🧪","🏆","🎸","🌙"];

function Av({ src, name, size = "md" }: { src?: string; name?: string; size?: "sm" | "md" | "lg" }) {
  const isImg = src?.startsWith("/") || src?.startsWith("http");
  const dims = { sm: "size-6", md: "size-8", lg: "size-10" }[size];
  return (
    <div className={cn("flex flex-shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden", dims)}>
      {isImg ? <img src={src} alt={name ?? ""} className="h-full w-full object-cover" /> : <span className="text-sm leading-none">{src || name?.[0]?.toUpperCase() || "?"}</span>}
    </div>
  );
}

// ─── Export to Markdown ───────────────────────────────────────────────────────
function exportToMarkdown(channel: GroupChannel, messages: GroupMessage[], agents: AgentDefinition[]): string {
  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));
  const lines: string[] = [
    `# ${channel.name}`,
    ``,
    `> 导出时间：${new Date().toLocaleString("zh-CN")}  `,
    `> 成员：${channel.agentIds.map((id) => agentMap[id]?.name ?? id).join("、")}`,
    ``,
    `---`,
    ``,
  ];
  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push(`**用户**  `, `*${moment(msg.timestamp).format("MM/DD HH:mm")}*`, ``, msg.content, ``, `---`, ``);
    } else {
      const agent = agentMap[msg.agentId ?? ""];
      lines.push(`**${msg.agentName ?? agent?.name ?? "Agent"}**  `, `*${moment(msg.timestamp).format("MM/DD HH:mm")}*`, ``, msg.content, ``, `---`, ``);
    }
  }
  return lines.join("\n");
}

function downloadMarkdown(filename: string, content: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
  a.download = filename; a.click();
}

// ─── Channel Modal ────────────────────────────────────────────────────────────
function ChannelModal({ open, onClose, initial, agents, onSave }: {
  open: boolean; onClose: () => void;
  initial?: GroupChannel | null;
  agents: AgentDefinition[];
  onSave: (name: string, agentIds: string[], avatar: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [avatar, setAvatar] = useState(initial?.avatar ?? "💬");
  const [ids, setIds] = useState<string[]>(initial?.agentIds ?? []);

  useEffect(() => {
    if (open) { setName(initial?.name ?? ""); setAvatar(initial?.avatar ?? "💬"); setIds(initial?.agentIds ?? []); }
  }, [open, initial]);

  const toggle = (id: string) => setIds((prev) => prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{initial ? "编辑频道" : "新建频道"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5"><Label className="text-xs">频道名称 *</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" /></div>
          <div className="space-y-1.5">
            <Label className="text-xs">图标</Label>
            <div className="flex flex-wrap gap-1.5">
              {CHANNEL_ICONS.map((ic) => (
                <button key={ic} onClick={() => setAvatar(ic)} className={cn("size-8 rounded-lg text-lg flex items-center justify-center transition-colors", avatar === ic ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-muted")}>{ic}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">成员 ({ids.length})</Label>
            <ScrollArea className="max-h-48">
              {agents.length === 0 ? <p className="text-xs text-muted-foreground py-2">请先在智能体页面添加智能体</p> : agents.map((a) => (
                <button key={a.id} onClick={() => toggle(a.id)} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-muted transition-colors", ids.includes(a.id) ? "bg-primary/5" : "")}>
                  <Av src={a.avatar} name={a.name} size="sm" />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="font-medium truncate">{a.name}</p>
                    <p className="text-[10px] opacity-60">{a.role ?? ""}</p>
                  </div>
                  {ids.includes(a.id) && <span className="size-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px]">✓</span>}
                </button>
              ))}
            </ScrollArea>
          </div>
        </div>
        <div className="flex justify-between pt-3 border-t mt-2">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">取消</button>
          <Button size="sm" className="h-8 text-xs" onClick={() => { onSave(name, ids, avatar); onClose(); }} disabled={!name.trim()}>保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function GroupDiscussion() {
  const { agents } = useAgents();
  const {
    channels, messages, selectedId, selectChannel,
    createChannel, editChannel: hookEditChannel, removeChannel,
    sendMessage, isSending, stopGeneration,
  } = useGroupChat();

  const [input, setInput] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editChannelState, setEditChannelState] = useState<GroupChannel | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeChannel = channels.find((c) => c.id === selectedId) ?? null;
  // hook returns flat messages array for the selected channel
  const activeMessages: GroupMessage[] = messages;

  const agentMap = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a])), [agents]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeMessages]);

  const send = async () => {
    if (!input.trim() || !selectedId || isSending) return;
    const text = input.trim(); setInput("");
    await sendMessage(text);
  };

  const handleExport = () => {
    if (!activeChannel) return;
    const md = exportToMarkdown(activeChannel, activeMessages, agents);
    downloadMarkdown(`${activeChannel.name}-${Date.now()}.md`, md);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Channel list */}
      <div className="flex w-64 flex-shrink-0 flex-col border-r bg-background">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">频道</span>
          <button onClick={() => { setEditChannelState(null); setModalOpen(true); }} title="新建频道" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Plus className="size-3.5" /></button>
        </div>
        <ScrollArea className="flex-1 px-2 pb-4">
          {channels.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <MessageSquare className="size-8 opacity-20" /><p className="text-xs">暂无频道</p>
              <button onClick={() => { setEditChannelState(null); setModalOpen(true); }} className="text-xs text-primary hover:underline">+ 新建</button>
            </div>
          ) : channels.map((ch) => (
            <div key={ch.id} role="button" tabIndex={0} onClick={() => selectChannel(ch.id)} onKeyDown={(e) => e.key === 'Enter' && selectChannel(ch.id)} className={cn("group flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2.5 text-xs transition-colors text-left", selectedId === ch.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <span className="text-base flex-shrink-0">{ch.avatar ?? "💬"}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{ch.name}</p>
                <p className="text-[10px] opacity-60">{ch.agentIds.length} 名成员</p>
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); setEditChannelState(ch); setModalOpen(true); }} className="p-1 rounded hover:bg-background"><Edit2 className="size-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); removeChannel(ch.id); }} className="p-1 rounded hover:bg-background hover:text-destructive"><Trash2 className="size-3" /></button>
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Main chat */}
      {!activeChannel ? (
        <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground bg-muted/20">
          <Hash className="size-12 opacity-20 mb-4" />
          <p className="text-sm">选择或新建一个频道开始对话</p>
          <button onClick={() => { setEditChannelState(null); setModalOpen(true); }} className="mt-3 text-xs text-primary hover:underline">+ 新建频道</button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex flex-shrink-0 items-center gap-3 border-b bg-background px-4 py-2.5">
            <span className="text-lg">{activeChannel.avatar ?? "💬"}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{activeChannel.name}</p>
              <p className="text-[10px] text-muted-foreground">{activeChannel.agentIds.length} 名成员</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleExport} title="导出为文章" className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <FileText className="size-3.5" />导出
              </button>
              <button onClick={() => setShowMembers((v) => !v)} className={cn("p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors", showMembers && "bg-muted text-foreground")}>
                <Users className="size-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Messages */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeMessages.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                    <span className="text-5xl">{activeChannel.avatar ?? "💬"}</span>
                    <p className="text-sm font-medium">{activeChannel.name}</p>
                    <p className="text-xs">开始发送消息，智能体们将依次响应</p>
                  </div>
                ) : activeMessages.map((msg) => {
                  const agent = msg.agentId ? agentMap[msg.agentId] : null;
                  const isUser = msg.role === "user";
                  return (
                    <div key={msg.id} className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
                      {!isUser && <Av src={agent?.avatar ?? msg.agentAvatar} name={msg.agentName} size="md" />}
                      <div className={cn("max-w-[70%] flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
                        {!isUser && <span className="text-[11px] font-medium text-muted-foreground">{msg.agentName ?? agent?.name}</span>}
                        <div className={cn("rounded-2xl px-4 py-2.5 text-sm", isUser ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm")}>
                          <Markdown>{msg.content}</Markdown>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{moment(msg.timestamp).format("HH:mm")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              <div className="flex-shrink-0 border-t bg-background px-4 py-3">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                    placeholder={`发消息给 ${activeChannel.name}…`}
                    rows={1}
                    className="flex-1 min-h-[36px] max-h-32 text-sm resize-none"
                  />
                  {isSending ? (
                    <button onClick={() => stopGeneration()} className="flex-shrink-0 p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20">
                      <Square className="size-4" />
                    </button>
                  ) : (
                    <button onClick={() => void send()} disabled={!input.trim()} className="flex-shrink-0 p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40">
                      <Send className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Members panel */}
            {showMembers && (
              <div className="flex w-56 flex-col border-l bg-background overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 border-b">
                  <span className="text-xs font-semibold text-muted-foreground">成员</span>
                  <button onClick={() => setShowMembers(false)}><X className="size-3.5 text-muted-foreground" /></button>
                </div>
                <ScrollArea className="flex-1 px-2 py-2">
                  {activeChannel.agentIds.map((id) => {
                    const a = agentMap[id];
                    if (!a) return null;
                    return (
                      <div key={id} className="flex items-center gap-2 rounded-lg px-2 py-2">
                        <Av src={a.avatar} name={a.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{a.name}</p>
                          <p className="text-[10px] opacity-60 truncate">{a.role ?? ""}</p>
                        </div>
                      </div>
                    );
                  })}
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Channel modal */}
      <ChannelModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editChannelState}
        agents={agents}
        onSave={(name, agentIds, avatar) => {
          if (editChannelState) { hookEditChannel(editChannelState.id, { name, agentIds, avatar }); }
          else { createChannel(name, agentIds, avatar); }
        }}
      />
    </div>
  );
}

export default GroupDiscussion;
