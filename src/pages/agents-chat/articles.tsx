import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import type { Editor } from "@tiptap/core";
import {
  Bold,
  CheckSquare,
  Clipboard,
  Code2,
  Download,
  Eye,
  FileInput,
  FolderDown,
  Heading1,
  Heading2,
  ImagePlus,
  Link2,
  List,
  ListOrdered,
  LoaderCircle,
  PencilLine,
  Plus,
  Quote,
  Save,
  Sigma,
  Split,
  Table2,
  Trash2,
  Upload,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { documentDir, join } from "@tauri-apps/api/path";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Markdown as MarkdownPreview } from "@/components/Markdown";
import { ArticleEditor } from "@/components/article-editor/ArticleEditor";
import "@/components/article-editor/editor.css";

type ArticleRecord = {
  id: string;
  title: string;
  summary: string;
  content: string;
  cover: string;
  tags: string[];
  updatedAt: string;
};

type EditorMode = "write" | "split" | "preview";

const STORAGE_KEY = "niuma.articles";

function createArticle(partial?: Partial<ArticleRecord>): ArticleRecord {
  const now = new Date().toISOString();
  return {
    id: partial?.id ?? crypto.randomUUID(),
    title: partial?.title ?? i18n.t("articles.untitled", { ns: "pages" }),
    summary: partial?.summary ?? "",
    content: partial?.content ?? "",
    cover: partial?.cover ?? "",
    tags: partial?.tags ?? [],
    updatedAt: partial?.updatedAt ?? now,
  };
}

function readArticles() {
  if (typeof window === "undefined") return [] as ArticleRecord[];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ArticleRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => createArticle(item));
  } catch {
    return [];
  }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<ArticleRecord[]>(() => {
    const stored = readArticles();
    return stored.length ? stored : [createArticle()];
  });
  const [activeId, setActiveId] = useState<string>(() => {
    const stored = readArticles();
    return stored[0]?.id ?? createArticle().id;
  });
  const [mode, setMode] = useState<EditorMode>("write");
  const [markdownSource, setMarkdownSource] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeIdRef = useRef(activeId);
  // Tracks whether a setContent call is in-flight so onUpdate skips writing
  // back to articles state and avoids an infinite loop.
  const isSettingContentRef = useRef(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const { t } = useTranslation("pages");

  const activeArticle = useMemo(() => {
    return articles.find((article) => article.id === activeId) ?? articles[0] ?? null;
  }, [activeId, articles]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const handleEditorUpdate = useCallback((content: string) => {
    if (isSettingContentRef.current) return;
    setMarkdownSource(content);
    setArticles((current) =>
      current.map((article) =>
        article.id === activeIdRef.current
          ? { ...article, content, updatedAt: new Date().toISOString() }
          : article
      )
    );
  }, []);

  const handleEditorCreate = useCallback((content: string) => {
    setMarkdownSource(content);
  }, []);

  const handleDropFile = useCallback(async (editorInstance: Editor, files: File[], position: number) => {
    for (const file of files) {
      const url = await fileToDataUrl(file);
      editorInstance.chain().focus().insertContentAt(position, { type: "image", attrs: { src: url, alt: file.name } }).run();
    }
  }, []);

  const handlePasteFile = useCallback(async (editorInstance: Editor, files: File[]) => {
    for (const file of files) {
      const url = await fileToDataUrl(file);
      editorInstance.chain().focus().setImage({ src: url, alt: file.name }).run();
    }
  }, []);

  // Sync editor content when the active article changes (e.g. user switches
  // articles from the selector). We guard with isSettingContentRef so the
  // onUpdate handler does not overwrite the newly loaded article.
  useEffect(() => {
    if (!editor || !activeArticle) return;
    const current = editor.getMarkdown();
    if (current === activeArticle.content) return;
    isSettingContentRef.current = true;
    editor.commands.setContent(activeArticle.content || "");
    setMarkdownSource(activeArticle.content || "");
    // Allow onUpdate to fire again after React flushes
    requestAnimationFrame(() => {
      isSettingContentRef.current = false;
    });
  // Only re-run when the active article id changes, not on every content update
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, editor]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
  }, [articles]);

  const updateArticle = (patch: Partial<ArticleRecord>) => {
    if (!activeArticle) return;
    setArticles((current) =>
      current.map((article) =>
        article.id === activeArticle.id
          ? {
              ...article,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : article
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    setIsSaving(false);
    toast.success(t("articles.toast.saved"));
  };

  const handleCreateArticle = () => {
    const next = createArticle();
    setArticles((current) => [next, ...current]);
    setActiveId(next.id);
    setMode("write");
    toast.success(t("articles.toast.created"));
  };

  const handleDeleteArticle = () => {
    if (!activeArticle) return;
    const nextArticles = articles.filter((article) => article.id !== activeArticle.id);
    if (!nextArticles.length) {
      const fallback = createArticle();
      setArticles([fallback]);
      setActiveId(fallback.id);
      toast.success(t("articles.toast.deletedWithFallback"));
      return;
    }
    setArticles(nextArticles);
    setActiveId(nextArticles[0].id);
    toast.success(t("articles.toast.deleted"));
  };

  const handleExportMarkdown = () => {
    if (!activeArticle) return;
    const blob = new Blob([activeArticle.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeArticle.title || "article"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportMarkdown = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const title = file.name.replace(/\.md$/i, "") || i18n.t("articles.untitled", { ns: "pages" });
      const imported = createArticle({ title, content: text });
      setArticles((current) => [imported, ...current]);
      setActiveId(imported.id);
      setMode("write");
      toast.success(t("articles.toast.mdImported"));
    } catch {
      toast.error(t("articles.toast.importFailed"));
    }
  };

  const insertImageFromFile = async (file: File | null) => {
    if (!file || !editor) return;
    try {
      const url = await fileToDataUrl(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      toast.success(t("articles.toast.imageInserted"));
    } catch {
      toast.error(t("articles.toast.imageReadFailed"));
    }
  };

  const handleSaveToDisk = async () => {
    if (!activeArticle) return;
    try {
      const docDir = await documentDir();
      const slug = (activeArticle.title || "untitled")
        .replace(/[\\/:*?"<>|]/g, "")
        .trim() || "untitled";
      const fileName = `${slug}.md`;
      const folderPath = await join(docDir, "niuma", "articles");
      const filePath = await join(folderPath, fileName);
      await invoke("fs_write", {
        req: {
          workspaceRoot: docDir,
          path: filePath,
          content: activeArticle.content,
          sandboxMode: "danger-full-access",
        },
      });
      toast.success(t("articles.toast.savedToDisk", { path: folderPath }));
    } catch (e) {
      toast.error(t("articles.toast.saveToDiskFailed", { error: String(e) }));
    }
  };

  const handleShare = async () => {
    if (!activeArticle) return;
    try {
      await navigator.clipboard.writeText(activeArticle.content);
      toast.success(t("articles.toast.mdCopied"));
    } catch {
      toast.error(t("articles.toast.copyFailed"));
    }
  };

  if (!activeArticle) return null;

  // ── Icon-only toolbar button style ──────────────────────────────────────────
  const tb = (active = false) =>
    cn(
      "inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
      active
        ? "bg-indigo-100 text-indigo-700"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    );

  return (
    <div className="flex h-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.06),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      {/* ── LEFT COLUMN: toolbar + editor ──────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col border-r border-slate-100 bg-white/80 backdrop-blur">

        {/* Title row */}
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-2">
          <Input
            value={activeArticle.title}
            onChange={(e) => updateArticle({ title: e.target.value || i18n.t("articles.untitled", { ns: "pages" }) })}
            className="h-9 border-0 bg-transparent px-0 text-lg font-semibold tracking-tight text-slate-900 shadow-none placeholder:text-slate-300 focus-visible:ring-0"
            placeholder={t("articles.titlePlaceholder")}
          />
        </div>

        {/* Toolbar row – icon only */}
        <div className="flex flex-shrink-0 flex-wrap items-center gap-0.5 border-b border-slate-100 px-3 py-1.5">
          {/* Mode group */}
          <button type="button" title={t("articles.toolbar.edit")} className={tb(mode === "write")} onClick={() => setMode("write")}>
            <PencilLine className="size-4" />
          </button>
          <button type="button" title={t("articles.toolbar.split")} className={tb(mode === "split")} onClick={() => setMode("split")}>
            <Split className="size-4" />
          </button>
          <button type="button" title={t("articles.toolbar.preview")} className={tb(mode === "preview")} onClick={() => setMode("preview")}>
            <Eye className="size-4" />
          </button>

          <span className="mx-1.5 h-5 w-px bg-slate-200" />

          {/* Save */}
          <button type="button" title={t("articles.toolbar.save")} className={tb()} onClick={() => void handleSave()}>
            {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          </button>
          {/* Download */}
          <button type="button" title={t("articles.toolbar.downloadMd")} className={tb()} onClick={handleExportMarkdown}>
            <Download className="size-4" />
          </button>
          {/* Import */}
          <label title={t("articles.toolbar.importMd")} className={cn(tb(), "cursor-pointer")}>
            <Upload className="size-4" />
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,text/markdown"
              className="hidden"
              onChange={(e) => {
                void handleImportMarkdown(e.target.files?.[0] ?? null);
                e.currentTarget.value = "";
              }}
            />
          </label>

          <span className="mx-1.5 h-5 w-px bg-slate-200" />

          {/* Formatting */}
          <button type="button" title={t("articles.toolbar.bold")} className={tb(editor?.isActive("bold"))} onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold className="size-4" />
          </button>
          <button type="button" title={t("articles.toolbar.heading1")} className={tb(editor?.isActive("heading", { level: 1 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 className="size-4" />
          </button>
          <button type="button" title={t("articles.toolbar.heading2")} className={tb(editor?.isActive("heading", { level: 2 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="size-4" />
          </button>
          <button type="button" title={t("articles.toolbar.bulletList")} className={tb(editor?.isActive("bulletList"))} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            <List className="size-4" />
          </button>
          <button type="button" title={t("articles.toolbar.orderedList")} className={tb(editor?.isActive("orderedList"))} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="size-4" />
          </button>
          <button type="button" title={t("articles.toolbar.taskList")} className={tb(editor?.isActive("taskList"))} onClick={() => editor?.chain().focus().toggleTaskList().run()}>
            <CheckSquare className="size-4" />
          </button>
          <button type="button" title={t("articles.toolbar.blockquote")} className={tb(editor?.isActive("blockquote"))} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
            <Quote className="size-4" />
          </button>
          <button type="button" title={t("articles.toolbar.codeBlock")} className={tb(editor?.isActive("codeBlock"))} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
            <Code2 className="size-4" />
          </button>
          <button type="button" title={t("articles.toolbar.math")} className={tb()} onClick={() => editor?.chain().focus().toggleMathDisplay().run()}>
            <Sigma className="size-4" />
          </button>
          <button type="button" title={t("articles.toolbar.insertTable")} className={tb()} onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <Table2 className="size-4" />
          </button>
          <button
            type="button"
            title={t("articles.toolbar.insertLink")}
            className={tb(editor?.isActive("link"))}
            onClick={() => {
              const href = window.prompt(i18n.t("articles.linkPrompt", { ns: "pages" }), "https://");
              if (!href) return;
              editor?.chain().focus().extendMarkRange("link").setLink({ href }).run();
            }}
          >
            <Link2 className="size-4" />
          </button>
          <label title={t("articles.toolbar.insertImage")} className={cn(tb(), "cursor-pointer")}>
            <ImagePlus className="size-4" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void insertImageFromFile(e.target.files?.[0] ?? null);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>

        {/* Editor / Preview area */}
        <div className={cn("min-h-0 flex-1 overflow-hidden", mode === "split" ? "grid grid-cols-2" : "grid grid-cols-1")}>
          {mode !== "preview" && (
            <div className={cn("min-w-0 overflow-y-auto", mode === "split" && "border-r border-slate-100")}>
              <ArticleEditor
                content={activeArticle.content}
                onUpdate={handleEditorUpdate}
                onCreate={handleEditorCreate}
                onEditorReady={setEditor}
                onDropFile={handleDropFile}
                onPasteFile={handlePasteFile}
              />
            </div>
          )}
          {mode !== "write" && (
            <div className={cn("min-w-0 overflow-y-auto", mode === "split" ? "bg-slate-50/80" : "bg-white")}>
              <div className="mx-auto max-w-3xl px-8 py-8">
                <MarkdownPreview>{markdownSource}</MarkdownPreview>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT COLUMN: actions + meta ───────────────────────────────────── */}
      <div className="flex w-72 flex-shrink-0 flex-col bg-white/70 backdrop-blur">

        {/* Action bar */}
        <div className="flex flex-shrink-0 items-center gap-1 border-b border-slate-100 px-3 py-2">
          <button type="button" title={t("articles.toolbar.exportMd")} className={tb()} onClick={handleExportMarkdown}>
            <Download className="size-4" />
          </button>
          <button type="button" title={t("articles.toolbar.copyClipboard")} className={tb()} onClick={() => void handleShare()}>
            <Clipboard className="size-4" />
          </button>
          <button type="button" title={t("articles.toolbar.newArticle")} className={tb()} onClick={handleCreateArticle}>
            <Plus className="size-4" />
          </button>
          <button type="button" title={t("articles.toolbar.deleteArticle")} className={tb()} onClick={handleDeleteArticle}>
            <Trash2 className="size-4" />
          </button>
          <span className="flex-1" />
          <button
            type="button"
            title={t("articles.toolbar.saveToDisk")}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 text-xs font-medium text-white hover:bg-indigo-500"
            onClick={() => void handleSaveToDisk()}
          >
            <FolderDown className="size-3.5" />
            {t("articles.meta.archive")}
          </button>
        </div>

        {/* Meta panel – scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-5 p-4">

            {/* Article selector */}
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-slate-400">{t("articles.meta.currentArticle")}</div>
              <select
                value={activeArticle.id}
                onChange={(e) => setActiveId(e.target.value)}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400"
              >
                {articles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title || i18n.t("articles.untitled", { ns: "pages" })}
                  </option>
                ))}
              </select>
            </div>

            {/* Cover */}
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-slate-400">{t("articles.meta.cover")}</div>
              {activeArticle.cover ? (
                <img src={activeArticle.cover} alt={activeArticle.title} className="h-36 w-full rounded-xl object-cover" />
              ) : (
                <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                  {t("articles.meta.noCover")}
                </div>
              )}
              <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                <FileInput className="size-3.5" />
                {t("articles.meta.uploadCover")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (!file) return;
                    const url = await fileToDataUrl(file);
                    updateArticle({ cover: url });
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            {/* Summary */}
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-slate-400">{t("articles.meta.summary")}</div>
              <textarea
                value={activeArticle.summary}
                onChange={(e) => updateArticle({ summary: e.target.value })}
                placeholder={t("articles.meta.summaryPlaceholder")}
                rows={4}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-700 outline-none transition focus:border-indigo-400"
              />
            </div>

            {/* Tags */}
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-slate-400">{t("articles.meta.tags")}</div>
              <Input
                value={activeArticle.tags.join(", ")}
                onChange={(e) => {
                  const tags = e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);
                  updateArticle({ tags });
                }}
                placeholder="AI, Product, Draft"
                className="h-8 rounded-xl text-sm"
              />
              {activeArticle.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeArticle.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-600">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
              <div className="flex items-center justify-between">
                <span>{t("articles.meta.lastUpdated")}</span>
                <span className="font-medium text-slate-700">{formatTime(activeArticle.updatedAt)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>{t("articles.meta.wordCount")}</span>
                <span className="font-medium text-slate-700">{markdownSource.replace(/\s+/g, "").length}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>{t("articles.meta.mode")}</span>
                <span className="font-medium text-slate-700">
                  {mode === "write" ? t("articles.meta.modeEdit") : mode === "split" ? t("articles.meta.modeSplit") : t("articles.meta.modePreview")}
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
