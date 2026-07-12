/**
 * Workstation › Skills
 *
 * Left  – My Skills list (installed skills, enable/disable toggle, save-to-file)
 * Right – Hub browser: search clawhub (skill.sh) registry, preview SKILL.md, install
 *
 * clawhub search hits https://skill.sh/api/search?q=<query> (public JSON)
 * Install = fetch SKILL.md from GitHub raw, create Skill record
 */
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, ScrollArea, Switch, Textarea } from "@/components/ui";
import { useSkills } from "@/hooks";
import type { Skill } from "@/types";
import { Check, CloudDownload, Edit2, ExternalLink, FileDown, FileUp, Loader2, Plus, Search, Trash2, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── clawhub types ────────────────────────────────────────────────────────────
interface HubSkill {
  name: string;
  description: string;
  author: string;
  repo: string;          // "owner/repo"
  path: string;          // "path/to/SKILL.md"
  ref?: string;          // branch/tag, default "main"
  tags?: string[];
}

// Fallback: if clawhub API is unavailable, show curated list
const CURATED: HubSkill[] = [
  { name: "Web Search",      description: "Search the web using DuckDuckGo and summarize results",  author: "niuma",   repo: "niuma-ai/skills",    path: "web-search/SKILL.md",    tags: ["search","web"] },
  { name: "Code Review",     description: "Review code for bugs, security issues and style",          author: "niuma",   repo: "niuma-ai/skills",    path: "code-review/SKILL.md",   tags: ["coding","review"] },
  { name: "Meeting Notes",   description: "Extract action items and decisions from meeting transcripts", author: "niuma", repo: "niuma-ai/skills", path: "meeting-notes/SKILL.md", tags: ["meeting","notes"] },
  { name: "Image Describe",  description: "Describe images in detail for accessibility or search",    author: "niuma",   repo: "niuma-ai/skills",    path: "image-describe/SKILL.md", tags: ["vision","image"] },
  { name: "Data Analyst",    description: "Analyse CSV/JSON data and produce charts in markdown",     author: "community", repo: "community-ai/skill-packs", path: "data-analyst/SKILL.md", tags: ["data","analysis"] },
  { name: "Translator",      description: "Translate text between languages with cultural context",   author: "community", repo: "community-ai/skill-packs", path: "translator/SKILL.md",   tags: ["language","translation"] },
];

async function fetchHub(q: string): Promise<HubSkill[]> {
  try {
    const res = await fetch(`https://skill.sh/api/search?q=${encodeURIComponent(q)}&limit=30`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error("hub error");
    return (await res.json()) as HubSkill[];
  } catch {
    // Fallback: filter curated list
    const kw = q.toLowerCase();
    return kw ? CURATED.filter((s) => s.name.toLowerCase().includes(kw) || s.description.toLowerCase().includes(kw) || (s.tags ?? []).some((t) => t.includes(kw))) : CURATED;
  }
}

async function fetchSkillMd(skill: HubSkill): Promise<string> {
  const ref = skill.ref ?? "main";
  const url = `https://raw.githubusercontent.com/${skill.repo}/${ref}/${skill.path}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Failed to fetch SKILL.md: ${res.status}`);
  return res.text();
}

function saveToFile(skill: Skill) {
  const { id: _, createdAt: _c, updatedAt: _u, ...def } = skill;
  const json = JSON.stringify(def, null, 2);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  a.download = `${skill.name.toLowerCase().replace(/\s+/g, "-")}.json`;
  a.click();
}

export default function SkillsPage() {
  const { skills, create, update, remove } = useSkills();
  // My skills
  const [mySearch, setMySearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "", content: "", tags: "", enabled: true });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Hub
  const [hubQuery, setHubQuery] = useState("");
  const [hubResults, setHubResults] = useState<HubSkill[]>(CURATED);
  const [hubLoading, setHubLoading] = useState(false);
  const [preview, setPreview] = useState<{ skill: HubSkill; content: string } | null>(null);
  const [installing, setInstalling] = useState<Set<string>>(new Set());
  const [previewLoading, setPreviewLoading] = useState(false);

  // Load hub on mount
  useEffect(() => { setHubResults(CURATED); }, []);

  const myList = skills.filter((s) => !mySearch || s.name.toLowerCase().includes(mySearch.toLowerCase()));
  const installedNames = new Set(skills.map((s) => s.name.toLowerCase()));

  // Search hub
  const searchHub = async () => {
    setHubLoading(true);
    try { setHubResults(await fetchHub(hubQuery)); } finally { setHubLoading(false); }
  };

  // Preview skill
  const openPreview = async (skill: HubSkill) => {
    setPreview({ skill, content: "" });
    setPreviewLoading(true);
    try { setPreview({ skill, content: await fetchSkillMd(skill) }); }
    catch { setPreview({ skill, content: "⚠️ 无法获取 SKILL.md，请检查网络连接。" }); }
    finally { setPreviewLoading(false); }
  };

  // Install from hub
  const installHub = async (skill: HubSkill, content?: string) => {
    const key = `${skill.repo}/${skill.path}`;
    setInstalling((s) => new Set(s).add(key));
    try {
      const md = content ?? await fetchSkillMd(skill).catch(() => "");
      await create({ name: skill.name, description: skill.description, content: md, enabled: true, tags: skill.tags ?? [], sourceType: "github", source: skill.repo, skillPath: skill.path, sourceRef: skill.ref ?? "main" });
    } finally { setInstalling((s) => { const n = new Set(s); n.delete(key); return n; }); }
  };

  // Edit / create skill
  const openNew = () => { setEditId(null); setDraft({ name: "", description: "", content: "", tags: "", enabled: true }); setEditOpen(true); };
  const openEdit = (s: Skill) => { setEditId(s.id); setDraft({ name: s.name, description: s.description, content: s.content ?? "", tags: (s.tags ?? []).join(", "), enabled: s.enabled }); setEditOpen(true); };
  const saveEdit = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    const data = { name: draft.name.trim(), description: draft.description.trim(), content: draft.content, enabled: draft.enabled, tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean) };
    try { editId ? await update(editId, data) : await create(data as any); setEditOpen(false); } finally { setSaving(false); }
  };

  // Import from file
  const importFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    if (file.name.endsWith(".md") || file.name === "SKILL.md") {
      reader.onload = (ev) => { setDraft({ name: file.name.replace(/\.md$/i, ""), description: "", content: ev.target?.result as string ?? "", tags: "", enabled: true }); setEditId(null); setEditOpen(true); };
      reader.readAsText(file);
    } else {
      reader.onload = (ev) => { try { const d = JSON.parse(ev.target?.result as string); setDraft({ name: d.name ?? "", description: d.description ?? "", content: d.content ?? "", tags: (d.tags ?? []).join(", "), enabled: d.enabled ?? true }); setEditId(null); setEditOpen(true); } catch { /* ignore */ } };
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* My Skills */}
      <div className="flex w-72 flex-shrink-0 flex-col border-r bg-background">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">我的技能</span>
          <div className="flex gap-1">
            <button onClick={() => fileRef.current?.click()} title="从文件导入" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><FileUp className="size-3.5" /></button>
            <button onClick={openNew} title="新建" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Plus className="size-3.5" /></button>
          </div>
          <input ref={fileRef} type="file" accept=".json,.md" className="hidden" onChange={importFile} />
        </div>
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <Input value={mySearch} onChange={(e) => setMySearch(e.target.value)} placeholder="搜索技能…" className="pl-7 h-7 text-xs" />
          </div>
        </div>
        <ScrollArea className="flex-1 px-2 pb-4">
          {myList.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Zap className="size-8 opacity-20" /><p className="text-xs">暂无技能</p>
              <button onClick={openNew} className="text-xs text-primary hover:underline">+ 新建</button>
            </div>
          ) : myList.map((s) => (
            <div key={s.id} className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted transition-colors">
              <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Zap className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{s.name}</p>
                <p className="text-[10px] opacity-60 truncate">{s.description}</p>
              </div>
              <Switch checked={s.enabled} onCheckedChange={(v) => void update(s.id, { enabled: v })} className="scale-75" />
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => void saveToFile(s)} title="保存文件" className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"><FileDown className="size-3" /></button>
                <button onClick={() => openEdit(s)} className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"><Edit2 className="size-3" /></button>
                <button onClick={() => void remove(s.id)} className="p-1 rounded hover:bg-background text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Hub browser */}
      <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
        <div className="flex flex-shrink-0 items-center gap-3 border-b bg-background px-5 py-3">
          <Zap className="size-4 text-muted-foreground" />
          <span className="font-semibold text-sm">技能市场 (clawhub)</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              <Input value={hubQuery} onChange={(e) => setHubQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void searchHub()} placeholder="搜索 skill.sh…" className="pl-6 h-7 text-xs w-56" />
            </div>
            <Button size="sm" className="h-7 text-xs" onClick={() => void searchHub()} disabled={hubLoading}>
              {hubLoading ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />}搜索
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Results list */}
          <ScrollArea className="flex-1 border-r">
            {hubLoading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground text-sm"><Loader2 className="size-5 animate-spin mr-2" />加载中…</div>
            ) : hubResults.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground"><Zap className="size-12 opacity-20" /><p className="text-sm">没有匹配的技能</p></div>
            ) : (
              <div className="p-4 space-y-2">
                {hubResults.map((s) => {
                  const key = `${s.repo}/${s.path}`;
                  const ing = installing.has(key);
                  const inst = installedNames.has(s.name.toLowerCase());
                  return (
                    <div key={key} onClick={() => void openPreview(s)} className={cn("flex items-start gap-3 rounded-xl border p-3 cursor-pointer hover:shadow-sm transition-all", preview?.skill.repo === s.repo && preview?.skill.path === s.path ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-card/80")}>
                      <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary mt-0.5">
                        <Zap className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{s.name}</p>
                          {inst && <Badge variant="secondary" className="text-[9px] h-4 px-1.5 text-emerald-600 bg-emerald-50">已安装</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.description}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-muted-foreground">{s.author} · {s.repo}</span>
                          {(s.tags ?? []).map((t) => <span key={t} className="text-[10px] bg-muted rounded-full px-1.5 py-0.5">{t}</span>)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); void installHub(s); }}
                        disabled={ing || inst}
                        className={cn("flex-shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors", inst ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : "bg-foreground text-background hover:opacity-90 disabled:opacity-40")}
                      >
                        {inst ? <><Check className="size-3" />已装</> : ing ? <Loader2 className="size-3 animate-spin" /> : <><CloudDownload className="size-3" />安装</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Preview panel */}
          {preview && (
            <div className="flex w-96 flex-col border-l bg-background overflow-hidden">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <div>
                  <p className="font-semibold text-sm">{preview.skill.name}</p>
                  <a href={`https://github.com/${preview.skill.repo}/blob/${preview.skill.ref ?? "main"}/${preview.skill.path}`} target="_blank" rel="noreferrer" className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5"><ExternalLink className="size-2.5" />{preview.skill.repo}</a>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={() => void installHub(preview.skill, preview.content)} disabled={installing.has(`${preview.skill.repo}/${preview.skill.path}`) || installedNames.has(preview.skill.name.toLowerCase())}>
                    {installedNames.has(preview.skill.name.toLowerCase()) ? <><Check className="size-3 mr-1" />已安装</> : <><CloudDownload className="size-3 mr-1" />安装</>}
                  </Button>
                  <button onClick={() => setPreview(null)} className="p-1 rounded hover:bg-muted text-muted-foreground"><X className="size-3.5" /></button>
                </div>
              </div>
              <ScrollArea className="flex-1 p-4">
                {previewLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" />加载中…</div>
                ) : (
                  <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground leading-relaxed">{preview.content}</pre>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      {/* Edit / Create modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader><DialogTitle>{editId ? "编辑技能" : "新建技能"}</DialogTitle></DialogHeader>
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-4 py-1">
              <div className="space-y-1.5"><Label className="text-xs">名称 *</Label><Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">描述</Label><Input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">标签 (逗号分隔)</Label><Input value={draft.tags} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} className="h-8 text-xs" placeholder="search, web, analysis" /></div>
              <div className="space-y-1.5">
                <Label className="text-xs">SKILL.md 内容</Label>
                <Textarea value={draft.content} onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))} rows={12} className="text-xs resize-none font-mono" placeholder="# Skill Name&#10;&#10;## Description&#10;...&#10;&#10;## System Prompt&#10;..." />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))} />
                <Label className="text-xs">启用此技能</Label>
              </div>
            </div>
          </ScrollArea>
          <div className="flex items-center justify-between pt-3 border-t mt-2">
            <button onClick={() => setEditOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">取消</button>
            <Button size="sm" className="h-8 text-xs" onClick={() => void saveEdit()} disabled={saving || !draft.name.trim()}>
              {saving && <Loader2 className="size-3 animate-spin mr-1" />}保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
