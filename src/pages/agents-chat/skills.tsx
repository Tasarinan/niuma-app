/**
 * Workstation > Skills (file-based)
 *
 * Full-width hub browser:
 * - Tab "内置技能" shows clawpack SKILL.md files with per-skill enable/disable toggle
 * - Tab "在线市场" searches skill.sh and installs skills to disk
 *
 * Disabled slugs are persisted in localStorage under "niuma-disabled-skills".
 */
import { useEffect, useState } from "react";
import { Badge, Button, Input, ScrollArea, Switch } from "@/components/ui";
import { fetchClawpackSkillCatalog, installSkillToClawpacks, type ClawpackSkill } from "@/lib/data";
import { Check, CloudDownload, ExternalLink, Loader2, Search, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface HubSkill {
  name: string;
  description: string;
  author: string;
  repo: string;
  path: string;
  ref?: string;
  tags?: string[];
}

const CURATED: HubSkill[] = [
  { name: "Web Search", description: "Search the web using DuckDuckGo and summarize results", author: "community", repo: "community-ai/skill-packs", path: "web-search/SKILL.md", tags: ["search", "web"] },
  { name: "Code Review", description: "Review code for bugs, security issues and style", author: "community", repo: "community-ai/skill-packs", path: "code-review/SKILL.md", tags: ["coding", "review"] },
  { name: "Image Describe", description: "Describe images in detail for accessibility or search", author: "community", repo: "community-ai/skill-packs", path: "image-describe/SKILL.md", tags: ["vision", "image"] },
  { name: "Data Analyst", description: "Analyse CSV/JSON data and produce charts in markdown", author: "community", repo: "community-ai/skill-packs", path: "data-analyst/SKILL.md", tags: ["data", "analysis"] },
  { name: "Translator", description: "Translate text between languages with cultural context", author: "community", repo: "community-ai/skill-packs", path: "translator/SKILL.md", tags: ["language"] },
  { name: "RAG QA", description: "Answer questions from documents using retrieval-augmented search", author: "community", repo: "community-ai/skill-packs", path: "rag-qa/SKILL.md", tags: ["rag", "qa"] },
];

async function fetchHub(query: string): Promise<HubSkill[]> {
  try {
    const response = await fetch(`https://skill.sh/api/search?q=${encodeURIComponent(query)}&limit=30`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("hub error");
    return (await response.json()) as HubSkill[];
  } catch {
    const keyword = query.toLowerCase();
    return keyword
      ? CURATED.filter(
          (skill) =>
            skill.name.toLowerCase().includes(keyword) ||
            skill.description.toLowerCase().includes(keyword) ||
            (skill.tags ?? []).some((tag) => tag.includes(keyword))
        )
      : CURATED;
  }
}

async function fetchSkillMd(skill: HubSkill): Promise<string> {
  const ref = skill.ref ?? "main";
  const url = `https://raw.githubusercontent.com/${skill.repo}/${ref}/${skill.path}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Failed to fetch SKILL.md: ${response.status}`);
  return response.text();
}

const LS_KEY = "niuma-disabled-skills";

function loadDisabled(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveDisabled(set: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...set]));
}

type HubTab = "builtin" | "online";

export default function SkillsPage() {
  const [builtinSkills, setBuiltinSkills] = useState<ClawpackSkill[]>([]);
  const [builtinLoading, setBuiltinLoading] = useState(true);
  const [builtinSearch, setBuiltinSearch] = useState("");
  const [builtinPreview, setBuiltinPreview] = useState<ClawpackSkill | null>(null);
  const [disabledSlugs, setDisabledSlugs] = useState<Set<string>>(loadDisabled);

  const [hubTab, setHubTab] = useState<HubTab>("builtin");
  const [hubQuery, setHubQuery] = useState("");
  const [hubResults, setHubResults] = useState<HubSkill[]>(CURATED);
  const [hubLoading, setHubLoading] = useState(false);
  const [preview, setPreview] = useState<{ skill: HubSkill; content: string } | null>(null);
  const [installing, setInstalling] = useState<Set<string>>(new Set());
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    setBuiltinLoading(true);
    fetchClawpackSkillCatalog()
      .then(setBuiltinSkills)
      .catch(console.error)
      .finally(() => setBuiltinLoading(false));
  }, []);

  const toggleEnabled = (slug: string) => {
    setDisabledSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      saveDisabled(next);
      return next;
    });
  };

  const builtinSlugs = new Set(builtinSkills.map((skill) => skill.slug));

  const onlineInstalled = (skill: HubSkill) => {
    const slug = skill.name
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
    return builtinSlugs.has(slug);
  };

  const searchHub = async () => {
    setHubLoading(true);
    try {
      setHubResults(await fetchHub(hubQuery));
    } finally {
      setHubLoading(false);
    }
  };

  const openPreview = async (skill: HubSkill) => {
    setPreview({ skill, content: "" });
    setPreviewLoading(true);
    try {
      setPreview({ skill, content: await fetchSkillMd(skill) });
    } catch {
      setPreview({ skill, content: "⚠️ 无法获取 SKILL.md，请检查网络连接" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const installHub = async (skill: HubSkill, content?: string) => {
    const key = `${skill.repo}/${skill.path}`;
    setInstalling((current) => new Set(current).add(key));
    try {
      const md = content ?? (await fetchSkillMd(skill));
      const slug =
        skill.name
          .toLowerCase()
          .replace(/[^a-z0-9-_]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 64) || "skill";

      const installed = await installSkillToClawpacks(slug, md);
      setBuiltinSkills((prev) => [...prev.filter((skillItem) => skillItem.slug !== slug), installed].sort((a, b) => a.name.localeCompare(b.name)));
      setBuiltinPreview(installed);
      setHubTab("builtin");
    } catch (error) {
      console.error("[installHub]", error);
    } finally {
      setInstalling((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const filtered = builtinSkills.filter(
    (skill) =>
      !builtinSearch ||
      skill.name.toLowerCase().includes(builtinSearch.toLowerCase()) ||
      skill.description.toLowerCase().includes(builtinSearch.toLowerCase()) ||
      skill.category.toLowerCase().includes(builtinSearch.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex flex-shrink-0 items-center gap-0 border-b bg-background px-4">
          <button
            onClick={() => setHubTab("builtin")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors",
              hubTab === "builtin" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Zap className="size-3" />内置技能
          </button>
          <button
            onClick={() => setHubTab("online")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors",
              hubTab === "online" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <CloudDownload className="size-3" />在线市场
          </button>
          {hubTab === "builtin" && (
            <div className="ml-auto flex items-center py-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <Input
                  value={builtinSearch}
                  onChange={(e) => setBuiltinSearch(e.target.value)}
                  placeholder="搜索内置技能…"
                  className="pl-6 h-7 text-xs w-52"
                />
              </div>
            </div>
          )}
          {hubTab === "online" && (
            <div className="ml-auto flex items-center gap-2 py-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <Input
                  value={hubQuery}
                  onChange={(e) => setHubQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void searchHub()}
                  placeholder="搜索 skill.sh…"
                  className="pl-6 h-7 text-xs w-52"
                />
              </div>
              <Button size="sm" className="h-7 text-xs" onClick={() => void searchHub()} disabled={hubLoading}>
                {hubLoading ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />}搜索
              </Button>
            </div>
          )}
        </div>

        {hubTab === "builtin" && (
          <div className="flex flex-1 overflow-hidden">
            <ScrollArea className="flex-1 border-r">
              {builtinLoading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
                  <Loader2 className="size-5 animate-spin mr-2" />加载内置技能…
                </div>
              ) : (
                <div className="p-4 space-y-1">
                  {filtered.map((skill) => {
                    const enabled = !disabledSlugs.has(skill.slug);

                    return (
                      <div
                        key={skill.slug}
                        onClick={() => setBuiltinPreview(skill)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-3 cursor-pointer hover:shadow-sm transition-all",
                          builtinPreview?.slug === skill.slug ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-card/80",
                          !enabled && "opacity-50"
                        )}
                      >
                        <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg mt-0.5">
                          {skill.icon || "⚡"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{skill.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{skill.description}</p>
                          {skill.category && <span className="text-[10px] text-muted-foreground mt-1 block">{skill.category}</span>}
                        </div>
                        <div className="flex items-center gap-2 self-center shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Switch checked={enabled} onCheckedChange={() => toggleEnabled(skill.slug)} className="scale-75" />
                        </div>
                      </div>
                    );
                  })}

                  {filtered.length === 0 && !builtinLoading && (
                    <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
                      <Zap className="size-10 opacity-20" />
                      <p className="text-sm">{builtinSearch ? "没有匹配的技能" : "暂无内置技能"}</p>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {builtinPreview && (
              <div className="flex w-96 flex-col border-l bg-background overflow-hidden">
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{builtinPreview.icon}</span>
                    <div>
                      <p className="font-semibold text-sm">{builtinPreview.name}</p>
                      {builtinPreview.category && <p className="text-[10px] text-muted-foreground">{builtinPreview.category}</p>}
                    </div>
                  </div>
                  <button onClick={() => setBuiltinPreview(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                    <X className="size-3.5" />
                  </button>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground leading-relaxed">{builtinPreview.raw}</pre>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {hubTab === "online" && (
          <div className="flex flex-1 overflow-hidden">
            <ScrollArea className="flex-1 border-r">
              {hubLoading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
                  <Loader2 className="size-5 animate-spin mr-2" />加载中…
                </div>
              ) : hubResults.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
                  <Zap className="size-12 opacity-20" />
                  <p className="text-sm">输入关键词搜索在线技能</p>
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {hubResults.map((skill) => {
                    const key = `${skill.repo}/${skill.path}`;
                    const installingNow = installing.has(key);
                    const installed = onlineInstalled(skill);

                    return (
                      <div
                        key={key}
                        onClick={() => void openPreview(skill)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-3 cursor-pointer hover:shadow-sm transition-all",
                          preview?.skill.repo === skill.repo && preview?.skill.path === skill.path ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-card/80"
                        )}
                      >
                        <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary mt-0.5">
                          <Zap className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm">{skill.name}</p>
                            {installed && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 text-emerald-600 bg-emerald-50">
                                已安装
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{skill.description}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-muted-foreground">
                              {skill.author} · {skill.repo}
                            </span>
                            {(skill.tags ?? []).map((tag) => (
                              <span key={tag} className="text-[10px] bg-muted rounded-full px-1.5 py-0.5">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void installHub(skill);
                          }}
                          disabled={installingNow || installed}
                          className={cn(
                            "flex-shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                            installed ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : "bg-foreground text-background hover:opacity-90 disabled:opacity-40"
                          )}
                        >
                          {installed ? <><Check className="size-3" />已装</> : installingNow ? <Loader2 className="size-3 animate-spin" /> : <><CloudDownload className="size-3" />安装</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {preview && (
              <div className="flex w-96 flex-col border-l bg-background overflow-hidden">
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                  <div>
                    <p className="font-semibold text-sm">{preview.skill.name}</p>
                    <a
                      href={`https://github.com/${preview.skill.repo}/blob/${preview.skill.ref ?? "main"}/${preview.skill.path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5"
                    >
                      <ExternalLink className="size-2.5" />{preview.skill.repo}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => void installHub(preview.skill, preview.content)}
                      disabled={installing.has(`${preview.skill.repo}/${preview.skill.path}`) || onlineInstalled(preview.skill)}
                    >
                      {onlineInstalled(preview.skill) ? <><Check className="size-3 mr-1" />已安装</> : <><CloudDownload className="size-3 mr-1" />安装到内置</>}
                    </Button>
                    <button onClick={() => setPreview(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
                <ScrollArea className="flex-1 p-4">
                  {previewLoading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="size-5 animate-spin mr-2" />加载中…
                    </div>
                  ) : (
                    <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground leading-relaxed">{preview.content}</pre>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
