/**
 * Workstation › Articles
 *
 * Articles are Markdown documents created from:
 *   – Exporting a channel conversation (via Channels page)
 *   – Creating a new blank article
 *   – Importing a .md file
 *
 * Storage: localStorage for demo (key: "niuma.articles")
 * Each article: { id, title, content, createdAt, updatedAt }
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Input, ScrollArea } from "@/components/ui";
import { Markdown } from "@/components";
import {
  Download, Edit2, Eye, FilePlus, FileText,
  Save, Trash2, Upload, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import moment from "moment";

interface Article {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "niuma.articles";

function loadArticles(): Article[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Article[]; }
  catch { return []; }
}
function saveArticles(articles: Article[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
}

// Accept markdown files dropped/imported from outside
function importFile(): Promise<{ title: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".md,.markdown,.txt";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve({ title: file.name.replace(/\.[^.]+$/, ""), content: String(reader.result) });
      reader.readAsText(file);
    };
    input.click();
  });
}

function downloadArticle(article: Article) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([article.content], { type: "text/markdown" }));
  a.download = `${article.title.replace(/\s+/g, "-")}.md`;
  a.click();
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>(() => loadArticles());
  const [activeId, setActiveId] = useState<string | null>(articles[0]?.id ?? null);
  const [editMode, setEditMode] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const active = articles.find((a) => a.id === activeId) ?? null;

  useEffect(() => {
    if (active) { setDraftTitle(active.title); setDraftContent(active.content); setDirty(false); }
  }, [activeId]); // eslint-disable-line

  const updateArticles = (next: Article[]) => { setArticles(next); saveArticles(next); };

  const newArticle = () => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const a: Article = { id, title: "新文章", content: "# 新文章\n\n在此编写内容…", createdAt: now, updatedAt: now };
    updateArticles([a, ...articles]);
    setActiveId(id); setEditMode(true);
  };

  const saveActive = useCallback(() => {
    if (!activeId) return;
    const updated = articles.map((a) => a.id === activeId ? { ...a, title: draftTitle || "未命名", content: draftContent, updatedAt: Date.now() } : a);
    updateArticles(updated); setDirty(false);
  }, [activeId, articles, draftTitle, draftContent]);

  const deleteActive = () => {
    if (!activeId) return;
    const next = articles.filter((a) => a.id !== activeId);
    updateArticles(next); setActiveId(next[0]?.id ?? null); setEditMode(false);
  };

  const doImport = async () => {
    const result = await importFile();
    if (!result) return;
    const id = crypto.randomUUID(); const now = Date.now();
    const a: Article = { id, title: result.title, content: result.content, createdAt: now, updatedAt: now };
    updateArticles([a, ...articles]); setActiveId(id);
  };

  // Ctrl+S save shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); if (editMode) saveActive(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editMode, saveActive]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="flex w-64 flex-shrink-0 flex-col border-r bg-background">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">文章</span>
          <div className="flex items-center gap-0.5">
            <button onClick={() => void doImport()} title="导入文件" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Upload className="size-3.5" /></button>
            <button onClick={newArticle} title="新建文章" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><FilePlus className="size-3.5" /></button>
          </div>
        </div>
        <ScrollArea className="flex-1 px-2 pb-4">
          {articles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <FileText className="size-8 opacity-20" />
              <p className="text-xs text-center">暂无文章<br />可从频道对话导出</p>
              <button onClick={newArticle} className="text-xs text-primary hover:underline">+ 新建</button>
            </div>
          ) : articles.map((a) => (
            <button
              key={a.id}
              onClick={() => { setActiveId(a.id); setEditMode(false); }}
              className={cn("group flex w-full flex-col gap-0.5 rounded-lg px-2 py-2.5 text-xs text-left transition-colors", activeId === a.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              <p className="font-medium truncate w-full">{a.title}</p>
              <p className="text-[10px] opacity-60">{moment(a.updatedAt).format("MM/DD HH:mm")}</p>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* Editor/viewer */}
      {!active ? (
        <div className="flex flex-1 flex-col items-center justify-center bg-muted/20 text-muted-foreground gap-3">
          <FileText className="size-12 opacity-20" />
          <p className="text-sm">选择或新建一篇文章</p>
          <button onClick={newArticle} className="text-xs text-primary hover:underline">+ 新建文章</button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-shrink-0 items-center gap-2 border-b bg-background px-4 py-2">
            {editMode ? (
              <Input value={draftTitle} onChange={(e) => { setDraftTitle(e.target.value); setDirty(true); }} className="h-7 text-sm font-semibold flex-1 border-0 bg-transparent px-0 focus-visible:ring-0 shadow-none" />
            ) : (
              <p className="flex-1 font-semibold text-sm truncate">{active.title}</p>
            )}
            <div className="flex items-center gap-1">
              {dirty && <span className="text-[10px] text-orange-500">未保存</span>}
              {editMode ? (
                <>
                  <button onClick={() => { saveActive(); setEditMode(false); }} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs bg-primary text-primary-foreground hover:opacity-90"><Save className="size-3" />保存</button>
                  <button onClick={() => { setEditMode(false); setDraftTitle(active.title); setDraftContent(active.content); setDirty(false); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="size-3.5" /></button>
                </>
              ) : (
                <button onClick={() => setEditMode(true)} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="size-3.5" />编辑</button>
              )}
              <button onClick={() => downloadArticle(active)} title="下载" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Download className="size-3.5" /></button>
              <button onClick={deleteActive} title="删除" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
            </div>
          </div>

          {editMode ? (
            /* Split: editor left, preview right */
            <div className="flex flex-1 overflow-hidden">
              <div className="flex w-1/2 flex-col border-r overflow-hidden">
                <div className="px-3 py-1.5 border-b bg-muted/30 flex items-center gap-1 text-[10px] text-muted-foreground"><Edit2 className="size-3" />编辑</div>
                <textarea
                  ref={textareaRef}
                  value={draftContent}
                  onChange={(e) => { setDraftContent(e.target.value); setDirty(true); }}
                  className="flex-1 resize-none bg-background p-4 text-sm font-mono outline-none overflow-y-auto"
                  spellCheck={false}
                />
              </div>
              <div className="flex w-1/2 flex-col overflow-hidden">
                <div className="px-3 py-1.5 border-b bg-muted/30 flex items-center gap-1 text-[10px] text-muted-foreground"><Eye className="size-3" />预览</div>
                <ScrollArea className="flex-1">
                  <div className="p-6 prose prose-sm dark:prose-invert max-w-none">
                    <Markdown>{draftContent}</Markdown>
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="mx-auto max-w-3xl p-8 prose prose-sm dark:prose-invert">
                <Markdown>{active.content}</Markdown>
              </div>
            </ScrollArea>
          )}

          {/* Footer meta */}
          {!editMode && (
            <div className="flex-shrink-0 border-t px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground bg-background">
              <span>创建 {moment(active.createdAt).format("YYYY/MM/DD HH:mm")}</span>
              <span>更新 {moment(active.updatedAt).format("YYYY/MM/DD HH:mm")}</span>
              <span>{active.content.length} 字符</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
