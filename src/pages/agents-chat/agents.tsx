/**
 * Workstation › Agents
 * DeDeClaw-style card market + My Agents sidebar + create/edit modal
 * Supports: save-to-file, import-from-file, install from catalog
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle,
  Input, Label, ScrollArea, Textarea,
} from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/store";
import { useAgents, useSkills, useMcpServers } from "@/hooks";
import { AGENT_INTERNAL_TOOL_IDS, type AgentDefinition, type AgentInternalToolId, type SandboxMode } from "@/types";
import { loadAgentCatalog, invalidateAgentCatalogCache, type CatalogAgent } from "@/lib/data/agent-loader";
import { Bot, CheckCircle2, Edit2, FileDown, FileUp, Loader2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SANDBOX_OPTIONS: { value: SandboxMode; label: string }[] = [
  { value: "read-only", label: "只读" },
  { value: "workspace-write", label: "工作区可写" },
  { value: "danger-full-access", label: "完全访问 ⚠️" },
];

const EMPTY: Omit<AgentDefinition, "id" | "createdAt" | "updatedAt"> = {
  name: "", role: "", avatar: "", description: "", systemPrompt: "",
  providerId: "", modelId: "",
  enabledInternalTools: [], enabledSkillIds: [], enabledMcpServerIds: [],
  sandboxMode: "read-only", temperature: 0.7, maxTokens: 4096, workspacePath: "",
};

function isImg(av?: string) { return !!av && (av.startsWith("/") || av.startsWith("http") || av.startsWith("data:")); }

function Avatar({ av, name, cls }: { av?: string; name: string; cls?: string }) {
  return (
    <div className={cn("flex-shrink-0 rounded-xl bg-muted overflow-hidden flex items-center justify-center", cls)}>
      {isImg(av) ? <img src={av} alt={name} className="w-full h-full object-cover" /> : <span className="text-xl">{av || "🤖"}</span>}
    </div>
  );
}

function saveToFile(agent: AgentDefinition) {
  const { id: _, createdAt: _c, updatedAt: _u, ...def } = agent;
  const json = JSON.stringify(def, null, 2);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  a.download = `${agent.name.toLowerCase().replace(/\s+/g, "-")}.json`;
  a.click();
}

export default function AgentsPage() {
  const { allAiProviders } = useApp();
  const { agents, create, update, remove } = useAgents();
  const { skills } = useSkills();
  const { servers: mcpServers } = useMcpServers();
  const [catalog, setCatalog] = useState<CatalogAgent[]>([]);
  const [cLoading, setCLoading] = useState(true);
  const [installing, setInstalling] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [cSearch, setCSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<typeof EMPTY>(EMPTY);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadAgentCatalog().then(setCatalog).finally(() => setCLoading(false)); }, []);

  const myNames = useMemo(() => new Set(agents.map((a) => a.name.toLowerCase())), [agents]);
  const myList = useMemo(() => agents.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()) || (a.role ?? "").toLowerCase().includes(search.toLowerCase())), [agents, search]);
  const catList = useMemo(() => catalog.filter((a) => !cSearch || a.name.toLowerCase().includes(cSearch.toLowerCase()) || (a.role ?? "").toLowerCase().includes(cSearch.toLowerCase()) || (a.description ?? "").toLowerCase().includes(cSearch.toLowerCase())), [catalog, cSearch]);

  const openNew = () => { setEditId(null); setDraft({ ...EMPTY }); setOpen(true); };
  const openEdit = (a: AgentDefinition) => { setEditId(a.id); const { id: _, createdAt: _c, updatedAt: _u, ...r } = a; setDraft(r); setOpen(true); };

  const save = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try { editId ? await update(editId, draft) : await create(draft); setOpen(false); } finally { setSaving(false); }
  };

  const install = async (agent: CatalogAgent) => {
    setInstalling((s) => new Set(s).add(agent.file));
    try {
      await create({
        name: agent.name, role: agent.role ?? "", avatar: agent.avatar ?? "",
        description: agent.description ?? "", systemPrompt: agent.systemPrompt ?? "",
        providerId: agent.providerId ?? "", modelId: agent.modelId ?? "",
        enabledInternalTools: (agent.enabledInternalTools ?? []) as AgentInternalToolId[],
        enabledSkillIds: agent.enabledSkillIds ?? [], enabledMcpServerIds: agent.enabledMcpServerIds ?? [],
        sandboxMode: (agent.sandboxMode ?? "read-only") as SandboxMode,
        temperature: agent.temperature ?? 0.7, maxTokens: agent.maxTokens ?? 4096,
        workspacePath: agent.workspacePath ?? "",
      });
    } finally { setInstalling((s) => { const n = new Set(s); n.delete(agent.file); return n; }); }
  };

  const importFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target?.result as string);
        setEditId(null);
        setDraft({ name: d.name ?? "", role: d.role ?? "", avatar: d.avatar ?? "", description: d.description ?? "", systemPrompt: d.systemPrompt ?? "", providerId: d.providerId ?? "", modelId: d.modelId ?? "", enabledInternalTools: d.enabledInternalTools ?? [], enabledSkillIds: d.enabledSkillIds ?? [], enabledMcpServerIds: d.enabledMcpServerIds ?? [], sandboxMode: d.sandboxMode ?? "read-only", temperature: d.temperature ?? 0.7, maxTokens: d.maxTokens ?? 4096, workspacePath: d.workspacePath ?? "" });
        setOpen(true);
      } catch { /* ignore */ }
    };
    reader.readAsText(file); e.target.value = "";
  };

  const refreshCatalog = () => { setCLoading(true); invalidateAgentCatalogCache(); loadAgentCatalog().then(setCatalog).finally(() => setCLoading(false)); };

  const toggle = <K extends keyof typeof EMPTY>(key: K, val: string) => {
    const cur = draft[key] as string[];
    setDraft((d) => ({ ...d, [key]: cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val] }));
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* My Agents sidebar */}
      <div className="flex w-64 flex-shrink-0 flex-col border-r bg-background">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">我的智能体</span>
          <div className="flex gap-1">
            <button onClick={() => fileRef.current?.click()} title="从文件导入" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><FileUp className="size-3.5" /></button>
            <button onClick={openNew} title="新建" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Plus className="size-3.5" /></button>
          </div>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={importFile} />
        </div>
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索…" className="pl-7 h-7 text-xs" />
          </div>
        </div>
        <ScrollArea className="flex-1 px-2 pb-4">
          {myList.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Bot className="size-8 opacity-20" />
              <p className="text-xs">暂无智能体</p>
              <button onClick={openNew} className="text-xs text-primary hover:underline">+ 新建</button>
            </div>
          ) : myList.map((a) => (
            <div key={a.id} className="group flex items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-muted transition-colors">
              <Avatar av={a.avatar} name={a.name} cls="size-8" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.name}</p>
                <p className="text-[10px] opacity-60 truncate">{a.role ?? ""}</p>
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => void saveToFile(a)} title="保存文件" className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"><FileDown className="size-3" /></button>
                <button onClick={() => openEdit(a)} title="编辑" className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"><Edit2 className="size-3" /></button>
                <button onClick={() => void remove(a.id)} title="删除" className="p-1 rounded hover:bg-background text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Catalog */}
      <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
        <div className="flex flex-shrink-0 items-center justify-between border-b bg-background px-5 py-3">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-muted-foreground" />
            <span className="font-semibold text-sm">智能体市场</span>
            <Badge variant="secondary">{catalog.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              <Input value={cSearch} onChange={(e) => setCSearch(e.target.value)} placeholder="搜索市场…" className="pl-6 h-7 text-xs w-44" />
            </div>
            <button onClick={refreshCatalog} title="刷新" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><RefreshCw className="size-3.5" /></button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          {cLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm"><Loader2 className="size-5 animate-spin mr-2" />加载中…</div>
          ) : catList.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground"><Bot className="size-12 opacity-20" /><p className="text-sm">{cSearch ? "没有匹配" : "目录为空"}</p></div>
          ) : (
            <div className="grid grid-cols-3 gap-3 p-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {catList.map((a) => {
                const installed = myNames.has(a.name.toLowerCase());
                const ing = installing.has(a.file);
                return (
                  <div key={a.file} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow select-none">
                    <div className="w-full aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
                      {isImg(a.avatar) ? <img src={a.avatar} alt={a.name} className="absolute inset-0 w-full h-full object-cover" /> : <span className="text-4xl leading-none">{a.avatar || "🤖"}</span>}
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-sm truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground truncate mb-2">{a.role}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px] mb-3">{a.description || "暂无简介"}</p>
                      {installed ? (
                        <div className="w-full py-1.5 rounded-lg text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center gap-1"><CheckCircle2 className="size-3" />已添加</div>
                      ) : (
                        <button onClick={() => void install(a)} disabled={ing} className="w-full py-1.5 rounded-lg text-xs font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-1">
                          {ing ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}添加
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>{editId ? "编辑智能体" : "新建智能体"}</DialogTitle></DialogHeader>
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">名称 *</Label><Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="h-8 text-xs" /></div>
                <div className="space-y-1.5"><Label className="text-xs">岗位</Label><Input value={draft.role ?? ""} onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))} className="h-8 text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">头像 (emoji/URL)</Label><Input value={draft.avatar ?? ""} onChange={(e) => setDraft((d) => ({ ...d, avatar: e.target.value }))} className="h-8 text-xs" placeholder="🤖" /></div>
                <div className="space-y-1.5">
                  <Label className="text-xs">沙箱模式</Label>
                  <Select value={draft.sandboxMode} onValueChange={(v) => setDraft((d) => ({ ...d, sandboxMode: v as SandboxMode }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{SANDBOX_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">简介</Label><Textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={2} className="text-xs resize-none" /></div>
              <div className="space-y-1.5"><Label className="text-xs">系统提示词</Label><Textarea value={draft.systemPrompt} onChange={(e) => setDraft((d) => ({ ...d, systemPrompt: e.target.value }))} rows={5} className="text-xs resize-none font-mono" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Provider</Label>
                  <select value={draft.providerId} onChange={(e) => setDraft((d) => ({ ...d, providerId: e.target.value }))} className="h-8 w-full rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">全局默认</option>
                    {allAiProviders.map((p) => <option key={p.id} value={p.id ?? ""}>{p.name ?? p.id}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Model ID</Label><Input value={draft.modelId} onChange={(e) => setDraft((d) => ({ ...d, modelId: e.target.value }))} className="h-8 text-xs" placeholder="留空使用全局" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Temperature ({draft.temperature})</Label><input type="range" min={0} max={2} step={0.1} value={draft.temperature} onChange={(e) => setDraft((d) => ({ ...d, temperature: parseFloat(e.target.value) }))} className="w-full accent-primary" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Max Tokens</Label><Input type="number" value={draft.maxTokens} onChange={(e) => setDraft((d) => ({ ...d, maxTokens: parseInt(e.target.value) || 4096 }))} className="h-8 text-xs" /></div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">内置工具</Label>
                <div className="flex flex-wrap gap-1.5">
                  {AGENT_INTERNAL_TOOL_IDS.map((t) => (
                    <button key={t} type="button" onClick={() => toggle("enabledInternalTools", t)} className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors", draft.enabledInternalTools.includes(t) ? "bg-primary text-primary-foreground border-transparent" : "bg-transparent text-muted-foreground border-border hover:border-primary/50")}>{t}</button>
                  ))}
                </div>
              </div>
              {skills.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">启用技能</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((s) => (
                      <button key={s.id} type="button" onClick={() => toggle("enabledSkillIds", s.id)} className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors", draft.enabledSkillIds.includes(s.id) ? "bg-primary text-primary-foreground border-transparent" : "bg-transparent text-muted-foreground border-border hover:border-primary/50")}>{s.name}</button>
                    ))}
                  </div>
                </div>
              )}
              {mcpServers.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">MCP 服务</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {mcpServers.map((s) => (
                      <button key={s.id} type="button" onClick={() => toggle("enabledMcpServerIds", s.id)} className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors", draft.enabledMcpServerIds.includes(s.id) ? "bg-primary text-primary-foreground border-transparent" : "bg-transparent text-muted-foreground border-border hover:border-primary/50")}>{s.name}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5"><Label className="text-xs">工作区路径</Label><Input value={draft.workspacePath} onChange={(e) => setDraft((d) => ({ ...d, workspacePath: e.target.value }))} className="h-8 text-xs" placeholder="留空=托管临时目录" /></div>
            </div>
          </ScrollArea>
          <div className="flex items-center justify-between pt-3 border-t mt-2">
            <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">取消</button>
            <Button size="sm" className="h-8 text-xs" onClick={() => void save()} disabled={saving || !draft.name.trim()}>
              {saving && <Loader2 className="size-3 animate-spin mr-1" />}保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
