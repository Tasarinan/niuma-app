import { useMemo, useState } from "react";
import { PageLayout } from "@/layouts";
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  ScrollArea,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/contexts";
import { useAgents, useSkills, useMcpServers } from "@/hooks";
import { AGENT_INTERNAL_TOOL_IDS } from "@/types";
import type {
  AgentDefinition,
  AgentInternalToolId,
  McpServer,
  McpTransport,
  SandboxMode,
  Skill,
} from "@/types";
import {
  Bot,
  CheckCircle2,
  MessageSquare,
  Pencil,
  Plus,
  Puzzle,
  Search,
  Server,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const SANDBOX_MODES: { value: SandboxMode; label: string }[] = [
  { value: "read-only", label: "只读" },
  { value: "workspace-write", label: "工作区可写" },
  { value: "danger-full-access", label: "完全访问" },
];

const AVATAR_OPTIONS = [
  "👩‍💼","👨‍💻","✍️","📊","🗂️","🤖","🧠","🎨","📐","🔬",
  "📝","💡","🧑‍🏫","🧑‍🔬","🧑‍💻","🎯","🚀","🔧","📱","🌐",
];

const ACTIVE_AGENT_KEY = "niuma-active-agent-id";
function getActiveAgentId(): string | null {
  try { return localStorage.getItem(ACTIVE_AGENT_KEY); } catch { return null; }
}
function persistActiveAgentId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_AGENT_KEY, id);
    else localStorage.removeItem(ACTIVE_AGENT_KEY);
  } catch {}
}

type AgentDraft = Omit<AgentDefinition, "id" | "createdAt" | "updatedAt">;

function emptyDraft(): AgentDraft {
  return {
    name: "",
    role: "",
    avatar: "🤖",
    description: "",
    systemPrompt: "You are a helpful assistant.",
    providerId: "",
    modelId: "",
    enabledInternalTools: [],
    enabledSkillIds: [],
    enabledMcpServerIds: [],
    sandboxMode: "read-only",
    temperature: 0.7,
    maxTokens: 4096,
    workspacePath: "",
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

const Agents = () => {
  const agentsApi = useAgents();
  const skillsApi = useSkills();
  const mcpApi = useMcpServers();

  return (
    <PageLayout
      title="人才市场"
      description="创建并管理 AI Agent，激活后在主聊天窗口中使用。"
    >
      <Tabs defaultValue="market" className="w-full">
        <TabsList>
          <TabsTrigger value="market">
            <Bot className="mr-1 size-4" /> 人才市场
          </TabsTrigger>
          <TabsTrigger value="skills">
            <Puzzle className="mr-1 size-4" /> Skills
          </TabsTrigger>
          <TabsTrigger value="mcp">
            <Server className="mr-1 size-4" /> MCP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="market" className="mt-4">
          <TalentMarket
            agents={agentsApi.agents}
            skills={skillsApi.skills}
            servers={mcpApi.servers}
            agentsApi={agentsApi}
          />
        </TabsContent>

        <TabsContent value="skills" className="mt-4">
          <SkillsPanel skillsApi={skillsApi} />
        </TabsContent>

        <TabsContent value="mcp" className="mt-4">
          <McpPanel mcpApi={mcpApi} />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
};

// ─── Talent Market ────────────────────────────────────────────────────────────

function TalentMarket({
  agents,
  skills,
  servers,
  agentsApi,
}: {
  agents: AgentDefinition[];
  skills: Skill[];
  servers: McpServer[];
  agentsApi: ReturnType<typeof useAgents>;
}) {
  const { setSystemPrompt } = useApp();
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(getActiveAgentId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentDefinition | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.role ?? "").toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
    );
  }, [agents, search]);

  const activeDef = useMemo(
    () => agents.find((a) => a.id === activeId) ?? null,
    [agents, activeId]
  );

  const handleActivate = (agent: AgentDefinition) => {
    persistActiveAgentId(agent.id);
    setActiveId(agent.id);
    setSystemPrompt(agent.systemPrompt);
  };

  const handleDeactivate = () => {
    persistActiveAgentId(null);
    setActiveId(null);
  };

  const openCreate = () => { setEditingAgent(null); setModalOpen(true); };
  const openEdit = (agent: AgentDefinition) => { setEditingAgent(agent); setModalOpen(true); };

  const handleSave = async (draft: AgentDraft) => {
    if (editingAgent) {
      await agentsApi.update(editingAgent.id, draft);
      if (activeId === editingAgent.id) setSystemPrompt(draft.systemPrompt);
    } else {
      await agentsApi.create(draft);
    }
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    agentsApi.remove(id);
    if (activeId === id) { persistActiveAgentId(null); setActiveId(null); }
  };

  const handleImport = async (items: AgentDraft[]) => {
    for (const item of items) await agentsApi.create(item);
    setImportOpen(false);
  };

  return (
    <div className="space-y-4">
      {activeDef && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          <span className="text-green-400 font-medium">当前激活：</span>
          {activeDef.avatar?.startsWith("/") || activeDef.avatar?.startsWith("http") ? (
            <img src={activeDef.avatar} alt={activeDef.name} className="h-5 w-5 rounded-full object-cover" />
          ) : (
            <span>{activeDef.avatar}</span>
          )}
          <span className="font-semibold">{activeDef.name}</span>
          {activeDef.role && <Badge variant="secondary" className="text-xs">{activeDef.role}</Badge>}
          <button onClick={handleDeactivate} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            取消激活
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="搜索名称、角色、描述…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1.5 size-4" /> 导入 JSON
        </Button>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 size-4" /> 新建 Agent
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {search ? "没有匹配的 Agent" : "还没有 Agent，点击「新建」开始"}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isActive={agent.id === activeId}
              onActivate={() => handleActivate(agent)}
              onEdit={() => openEdit(agent)}
              onDelete={() => handleDelete(agent.id)}
            />
          ))}
        </div>
      )}

      <AgentModal open={modalOpen} onOpenChange={setModalOpen} initial={editingAgent ?? undefined} skills={skills} servers={servers} onSave={handleSave} />
      <ImportModal open={importOpen} onOpenChange={setImportOpen} onImport={handleImport} />
    </div>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, isActive, onActivate, onEdit, onDelete }: {
  agent: AgentDefinition; isActive: boolean;
  onActivate: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className={`group relative flex flex-col rounded-xl border bg-card p-4 transition-shadow hover:shadow-md ${isActive ? "ring-2 ring-green-500/60" : ""}`}>
      {isActive && (
        <span className="absolute top-2 right-2 text-[10px] font-medium text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">激活中</span>
      )}
      <div className="mb-3 flex flex-col items-center gap-1.5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted overflow-hidden">
          {agent.avatar?.startsWith("/") || agent.avatar?.startsWith("http") ? (
            <img src={agent.avatar} alt={agent.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl">{agent.avatar || "🤖"}</span>
          )}
        </div>
        <div className="font-semibold">{agent.name}</div>
        {agent.role && <Badge variant="secondary" className="text-xs font-normal">{agent.role}</Badge>}
      </div>
      <p className="flex-1 text-xs text-muted-foreground line-clamp-3 text-center mb-4">
        {agent.description || "暂无描述"}
      </p>
      <div className="flex gap-1.5">
        <Button size="sm" className="flex-1 text-xs h-7" variant={isActive ? "secondary" : "default"} onClick={onActivate}>
          <MessageSquare className="mr-1 size-3" />{isActive ? "已激活" : "对话"}
        </Button>
        <Button size="icon" variant="outline" className="size-7" title="编辑" onClick={onEdit}>
          <Pencil className="size-3" />
        </Button>
        <Button size="icon" variant="ghost" className="size-7 text-destructive/70 hover:text-destructive" title="删除" onClick={onDelete}>
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Agent Modal ──────────────────────────────────────────────────────────────

function AgentModal({ open, onOpenChange, initial, skills, servers, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  initial?: AgentDefinition; skills: Skill[]; servers: McpServer[];
  onSave: (draft: AgentDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<AgentDraft>(() => initial ? { ...initial } : emptyDraft());
  const [saving, setSaving] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleOpenChange = (v: boolean) => {
    if (v) { setDraft(initial ? { ...initial } : emptyDraft()); setShowAvatarPicker(false); setShowAdvanced(false); }
    onOpenChange(v);
  };

  const patch = (updates: Partial<AgentDraft>) => setDraft((prev) => ({ ...prev, ...updates }));

  const toggleTool = (id: AgentInternalToolId) => {
    const s = new Set(draft.enabledInternalTools);
    s.has(id) ? s.delete(id) : s.add(id);
    patch({ enabledInternalTools: Array.from(s) });
  };

  const toggleId = (key: "enabledSkillIds" | "enabledMcpServerIds", id: string) => {
    const s = new Set(draft[key]);
    s.has(id) ? s.delete(id) : s.add(id);
    patch({ [key]: Array.from(s) } as Partial<AgentDraft>);
  };

  const handleSave = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑 Agent" : "新建 Agent"}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-2">
          <div className="space-y-4 pb-2">
            <div className="flex gap-3 items-start">
              <div className="flex flex-col items-center gap-1">
                <button type="button"
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-3xl hover:ring-2 hover:ring-primary/50 transition-all"
                  onClick={() => setShowAvatarPicker((v) => !v)} title="选择头像">
                  {draft.avatar?.startsWith("/") || draft.avatar?.startsWith("http") ? (
                    <img src={draft.avatar} alt="avatar" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span>{draft.avatar || "🤖"}</span>
                  )}
                </button>
                <span className="text-[10px] text-muted-foreground">点击换头像</span>
              </div>
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label>名称 *</Label>
                    <Input value={draft.name} placeholder="Alice" onChange={(e) => patch({ name: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>角色</Label>
                    <Input value={draft.role ?? ""} placeholder="通用助手" onChange={(e) => patch({ role: e.target.value })} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label>简介</Label>
                  <Input value={draft.description} placeholder="一句话描述 Agent 的专长…" onChange={(e) => patch({ description: e.target.value })} />
                </div>
              </div>
            </div>

            {showAvatarPicker && (
              <div className="flex flex-wrap gap-1.5 rounded-lg border bg-muted/30 p-3">
                {AVATAR_OPTIONS.map((emoji) => (
                  <button key={emoji} type="button"
                    className={`flex h-9 w-9 items-center justify-center rounded-md text-xl transition-colors hover:bg-accent ${draft.avatar === emoji ? "ring-2 ring-primary bg-accent" : ""}`}
                    onClick={() => { patch({ avatar: emoji }); setShowAvatarPicker(false); }}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <Label>系统提示词</Label>
              <Textarea rows={5} value={draft.systemPrompt} onChange={(e) => patch({ systemPrompt: e.target.value })} />
            </div>

            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowAdvanced((v) => !v)}>
              {showAdvanced ? "▾ 收起高级设置" : "▸ 展开高级设置"}
            </button>

            {showAdvanced && (
              <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label>沙箱模式</Label>
                    <Select value={draft.sandboxMode} onValueChange={(v) => patch({ sandboxMode: v as SandboxMode })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{SANDBOX_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Temperature</Label>
                    <Input type="number" min={0} max={2} step={0.1} className="h-8 text-xs" value={draft.temperature} onChange={(e) => patch({ temperature: Number(e.target.value) })} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Max Tokens</Label>
                    <Input type="number" className="h-8 text-xs" value={draft.maxTokens} onChange={(e) => patch({ maxTokens: Number(e.target.value) || 0 })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label>Provider ID（留空用激活的）</Label>
                    <Input className="h-8 text-xs" value={draft.providerId} placeholder="anthropic" onChange={(e) => patch({ providerId: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Model ID（留空用激活的）</Label>
                    <Input className="h-8 text-xs" value={draft.modelId} placeholder="claude-opus-4-5" onChange={(e) => patch({ modelId: e.target.value })} />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="flex items-center gap-1 text-xs"><Wrench className="size-3" /> 内置工具</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {AGENT_INTERNAL_TOOL_IDS.map((id) => {
                      const on = draft.enabledInternalTools.includes(id);
                      return <Badge key={id} variant={on ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => toggleTool(id)}>{id}</Badge>;
                    })}
                  </div>
                </div>

                {skills.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs">Skills</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.map((s) => {
                        const on = draft.enabledSkillIds.includes(s.id);
                        return <Badge key={s.id} variant={on ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => toggleId("enabledSkillIds", s.id)}>{s.name}</Badge>;
                      })}
                    </div>
                  </div>
                )}

                {servers.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs">MCP 服务器</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {servers.map((s) => {
                        const on = draft.enabledMcpServerIds.includes(s.id);
                        return <Badge key={s.id} variant={on ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => toggleId("enabledMcpServerIds", s.id)}>{s.name}</Badge>;
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <Label className="text-xs">工作目录（可选）</Label>
                  <Input className="h-8 text-xs" value={draft.workspacePath} placeholder="留空使用临时沙箱" onChange={(e) => patch({ workspacePath: e.target.value })} />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving || !draft.name.trim()}>{saving ? "保存中…" : "保存"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

const IMPORT_PLACEHOLDER = `支持单条对象或数组，例如：
[
  {
    "name": "张三",
    "role": "前端工程师",
    "avatar": "👨‍💻",
    "description": "精通 React / Vue",
    "systemPrompt": "You are a frontend expert..."
  }
]`;

function ImportModal({ open, onOpenChange, onImport }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onImport: (items: AgentDraft[]) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const parseJson = (): AgentDraft[] | null => {
    try {
      const raw: unknown = JSON.parse(text);
      const arr = Array.isArray(raw) ? raw : [raw];
      const result: AgentDraft[] = [];
      for (const [i, item] of arr.entries()) {
        if (typeof item !== "object" || item === null) { setError(`第 ${i + 1} 条必须是对象`); return null; }
        const obj = item as Record<string, unknown>;
        if (typeof obj.name !== "string" || !obj.name.trim()) { setError(`第 ${i + 1} 条缺少 name`); return null; }
        result.push({
          name: String(obj.name).trim(),
          role: typeof obj.role === "string" ? obj.role : "",
          avatar: typeof obj.avatar === "string" ? obj.avatar : "🤖",
          description: typeof obj.description === "string" ? obj.description : "",
          systemPrompt: typeof obj.systemPrompt === "string" ? obj.systemPrompt : "You are a helpful assistant.",
          providerId: typeof obj.providerId === "string" ? obj.providerId : "",
          modelId: typeof obj.modelId === "string" ? obj.modelId : "",
          enabledInternalTools: [], enabledSkillIds: [], enabledMcpServerIds: [],
          sandboxMode: "read-only",
          temperature: typeof obj.temperature === "number" ? obj.temperature : 0.7,
          maxTokens: typeof obj.maxTokens === "number" ? obj.maxTokens : 4096,
          workspacePath: "",
        });
      }
      return result;
    } catch { setError("JSON 格式不合法"); return null; }
  };

  const handleImport = async () => {
    setError(null);
    const items = parseJson();
    if (!items) return;
    setImporting(true);
    try { await onImport(items); setText(""); } finally { setImporting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>批量导入 Agent</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Textarea rows={10} className="font-mono text-xs" placeholder={IMPORT_PLACEHOLDER}
            value={text} onChange={(e) => { setText(e.target.value); setError(null); }} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={handleImport} disabled={importing || !text.trim()}>{importing ? "导入中…" : "导入"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Skills Panel ─────────────────────────────────────────────────────────────

function SkillsPanel({
  skillsApi,
}: {
  skillsApi: ReturnType<typeof useSkills>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");

  const add = () => {
    if (!name.trim()) return;
    skillsApi.create({
      name: name.trim(),
      description: description.trim(),
      enabled: true,
      tags: [],
      content,
    });
    setName("");
    setDescription("");
    setContent("");
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">新建技能</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>描述 (提供给模型选择技能)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>内容 (按需通过 load_skill 加载)</Label>
            <Textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <Button onClick={add}>
            <Plus className="mr-1 size-4" /> 添加
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">已有技能</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {skillsApi.skills.length === 0 && (
            <p className="text-xs text-muted-foreground">还没有技能</p>
          )}
          {skillsApi.skills.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-sm">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.description}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.enabled}
                  onCheckedChange={(v) =>
                    skillsApi.update(s.id, { enabled: v })
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => skillsApi.remove(s.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function McpPanel({ mcpApi }: { mcpApi: ReturnType<typeof useMcpServers> }) {
  const [name, setName] = useState("");
  const [transport, setTransport] = useState<McpTransport>("stdio");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");

  const add = () => {
    if (!name.trim()) return;
    mcpApi.create({
      name: name.trim(),
      transport,
      command: transport === "stdio" ? command.trim() : undefined,
      args: args.trim() ? args.trim().split(/\s+/) : [],
      url: transport === "stdio" ? undefined : url.trim(),
      env: {},
      enabled: true,
    });
    setName("");
    setCommand("");
    setArgs("");
    setUrl("");
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">新建 MCP 服务器</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>传输方式</Label>
            <Select
              value={transport}
              onValueChange={(v) => setTransport(v as McpTransport)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio">stdio</SelectItem>
                <SelectItem value="http">http</SelectItem>
                <SelectItem value="sse">sse</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {transport === "stdio" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>命令</Label>
                <Input
                  value={command}
                  placeholder="npx"
                  onChange={(e) => setCommand(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>参数 (空格分隔)</Label>
                <Input
                  value={args}
                  placeholder="-y @modelcontextprotocol/server-filesystem /path"
                  onChange={(e) => setArgs(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>URL</Label>
              <Input
                value={url}
                placeholder="https://example.com/mcp"
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          )}
          <Button onClick={add}>
            <Plus className="mr-1 size-4" /> 添加
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">已有服务器</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {mcpApi.servers.length === 0 && (
            <p className="text-xs text-muted-foreground">还没有 MCP 服务器</p>
          )}
          {mcpApi.servers.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-sm">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.transport} · {s.command ?? s.url ?? ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.enabled}
                  onCheckedChange={(v) => mcpApi.update(s.id, { enabled: v })}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => mcpApi.remove(s.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default Agents;
