/**
 * Workstation › Agents (file-based)
 *
 * Full-width catalog grid loaded from clawpacks/agents/*.json.
 * Each card has a 雇佣 / 取消雇佣 toggle.
 * Hired agent files persisted in localStorage under "niuma-hired-agents".
 */
import { useEffect, useMemo, useState } from "react";
import { Badge, Input, ScrollArea } from "@/components/ui";
import { loadAgentCatalog, invalidateAgentCatalogCache, type CatalogAgent } from "@/lib/data/agent-loader";
import { Bot, BriefcaseBusiness, Loader2, RefreshCw, Search, UserCheck, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Hired-agents persistence ─────────────────────────────────────────────────
const LS_HIRED = "niuma-hired-agents";
function loadHired(): Set<string> {
  try { const raw = localStorage.getItem(LS_HIRED); return raw ? new Set(JSON.parse(raw) as string[]) : new Set(); } catch { return new Set(); }
}
function saveHired(set: Set<string>) { localStorage.setItem(LS_HIRED, JSON.stringify([...set])); }

function isImg(av?: string) { return !!av && (av.startsWith("/") || av.startsWith("http") || av.startsWith("data:")); }

export default function AgentsPage() {
  const [catalog, setCatalog] = useState<CatalogAgent[]>([]);
  const [cLoading, setCLoading] = useState(true);
  const [cSearch, setCSearch] = useState("");
  const [hiredFiles, setHiredFiles] = useState<Set<string>>(loadHired);

  useEffect(() => { loadAgentCatalog().then(setCatalog).finally(() => setCLoading(false)); }, []);

  const catList = useMemo(() => catalog.filter((a) => !cSearch || a.name.toLowerCase().includes(cSearch.toLowerCase()) || (a.role ?? "").toLowerCase().includes(cSearch.toLowerCase()) || (a.description ?? "").toLowerCase().includes(cSearch.toLowerCase())), [catalog, cSearch]);

  const refreshCatalog = () => { setCLoading(true); invalidateAgentCatalogCache(); loadAgentCatalog().then(setCatalog).finally(() => setCLoading(false)); };

  const toggleHire = (file: string) => {
    setHiredFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) { next.delete(file); } else { next.add(file); }
      saveHired(next);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-muted/20">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b bg-background px-5 py-3">
        <div className="flex items-center gap-2">
          <BriefcaseBusiness className="size-4 text-muted-foreground" />
          <span className="font-semibold text-sm">智能体</span>
          <Badge variant="secondary">{catalog.length}</Badge>
          {hiredFiles.size > 0 && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 text-[10px]">
              在职 {hiredFiles.size}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <Input value={cSearch} onChange={(e) => setCSearch(e.target.value)} placeholder="搜索…" className="pl-6 h-7 text-xs w-44" />
          </div>
          <button onClick={refreshCatalog} title="刷新" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><RefreshCw className="size-3.5" /></button>
        </div>
      </div>

      {/* Grid */}
      <ScrollArea className="flex-1">
        {cLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm"><Loader2 className="size-5 animate-spin mr-2" />加载中…</div>
        ) : catList.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground"><Bot className="size-12 opacity-20" /><p className="text-sm">{cSearch ? "没有匹配" : "目录为空"}</p></div>
        ) : (
          <div className="grid grid-cols-3 gap-3 p-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {catList.map((a) => {
              const hired = hiredFiles.has(a.file);
              return (
                <div key={a.file} className={cn("bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all select-none", hired ? "border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-200 dark:ring-emerald-800" : "border-border")}>
                  <div className="w-full aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
                    {isImg(a.avatar) ? <img src={a.avatar} alt={a.name} className="absolute inset-0 w-full h-full object-cover" /> : <span className="text-4xl leading-none">{a.avatar || "🤖"}</span>}
                    {hired && (
                      <div className="absolute top-1.5 right-1.5 bg-emerald-500 rounded-full p-0.5">
                        <UserCheck className="size-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-sm truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground truncate mb-2">{a.role}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px] mb-3">{a.description || "暂无简介"}</p>
                    <button
                      onClick={() => toggleHire(a.file)}
                      className={cn(
                        "w-full py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1",
                        hired
                          ? "bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600 dark:bg-emerald-950/30 dark:hover:bg-red-950/30 border border-emerald-200 dark:border-emerald-800 hover:border-red-200"
                          : "bg-foreground text-background hover:opacity-90"
                      )}
                    >
                      {hired ? <><UserMinus className="size-3" />取消雇佣</> : <><UserCheck className="size-3" />雇佣</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
