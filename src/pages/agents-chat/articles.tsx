import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import type { Editor } from "@tiptap/core";
import {
  Bold,
  BookMarked,
  CheckSquare,
  Clipboard,
  Code2,
  Download,
  Eye,
  FilePenLine,
  FileInput,
  Heading1,
  Heading2,
  ImagePlus,
  Link2,
  List,
  ListOrdered,
  LoaderCircle,
  Maximize2,
  MessageSquareText,
  MoreVertical,
  PencilLine,
  Plus,
  Quote,
  Save,
  Sigma,
  Split,
  Table2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { openArtifactArticle, saveArticleToArtifact, scanArtifactArticles } from "@/lib/artifact/article-repo";
import { Markdown as MarkdownPreview } from "@/components/Markdown";
import { ArticleEditor } from "@/components/article-editor/ArticleEditor";
import { ArtifactTreeMenu } from "@/components/artifact-tree";
import { useArticleArtifactTree } from "@/hooks/useArticleArtifactTree";
import { importMarkdownToFeiniao, listFeiniaoArticles, type ImaKbItem } from "@/lib/functions/ima.api";
import { getImaKbConfig, setImaKbConfig } from "@/lib/storage/ima.storage";
import "@/components/article-editor/editor.css";

type ArticleRecord = {
  id: string;
  title: string;
  summary: string;
  content: string;
  cover: string;
  tags: string[];
  updatedAt: string;
  filePath?: string;
};

type EditorMode = "write" | "split" | "preview";
type WorkbenchView = "chat" | "editor";

interface ArticlesPageProps {
  activeView?: WorkbenchView;
  onViewChange?: (view: WorkbenchView) => void;
  onToggleMaximize?: () => void;
  onClose?: () => void;
  isMaximized?: boolean;
}

const STORAGE_KEY = "niuma.artifact.articles";
const LEGACY_STORAGE_KEY = "niuma.articles";

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
    filePath: partial?.filePath,
  };
}

function readArticles() {
  if (typeof window === "undefined") return [] as ArticleRecord[];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
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

export default function ArticlesPage({
  activeView = "editor",
  onViewChange,
  onToggleMaximize,
  onClose,
  isMaximized = false,
}: ArticlesPageProps = {}) {
  const { treeRoots, refreshTree } = useArticleArtifactTree();
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
  const [isPublishingToFeiniao, setIsPublishingToFeiniao] = useState(false);
  const [feiniaoKbDialogOpen, setFeiniaoKbDialogOpen] = useState(false);
  const [feiniaoKbInputValue, setFeiniaoKbInputValue] = useState("");
  const [feiniaoFolderInputValue, setFeiniaoFolderInputValue] = useState("");
  const [feiniaoArticles, setFeiniaoArticles] = useState<ImaKbItem[]>([]);
  const [isLoadingFeiniao, setIsLoadingFeiniao] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeIdRef = useRef(activeId);
  const lastSavedSnapshotRef = useRef<Record<string, string>>({});
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

  const getArticleSnapshot = useCallback((article: Pick<ArticleRecord, "title" | "content">) => {
    return JSON.stringify({
      title: article.title,
      content: article.content,
    });
  }, []);

  const refreshArticlesFromDisk = useCallback(async () => {
    try {
      const scanned = await scanArtifactArticles();
      if (!scanned.length) return;

      for (const item of scanned) {
        lastSavedSnapshotRef.current[item.filePath] = getArticleSnapshot({
          title: item.title,
          content: item.content,
        });
      }

      setArticles((current) => {
        const fromDisk = scanned.map((item) =>
          createArticle({
            id: item.filePath,
            title: item.title,
            content: item.content,
            updatedAt: item.updatedAt,
            filePath: item.filePath,
          })
        );

        const byId = new Map<string, ArticleRecord>();
        for (const item of current) byId.set(item.id, item);
        for (const item of fromDisk) byId.set(item.id, item);
        return Array.from(byId.values());
      });

      setActiveId((prev) => {
        if (scanned.some((item) => item.filePath === prev)) return prev;
        return scanned[0]?.filePath ?? prev;
      });
    } catch {
      // Keep local-only mode working even if disk scan fails.
    } finally {
      void refreshTree();
    }
  }, [getArticleSnapshot, refreshTree]);

  useEffect(() => {
    void refreshArticlesFromDisk();
  }, [refreshArticlesFromDisk]);

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  useEffect(() => {
    const handleFocus = () => {
      void refreshArticlesFromDisk();
      void refreshTree();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshArticlesFromDisk, refreshTree]);

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

  const persistArticle = useCallback(
    async (article: ArticleRecord, options?: { silent?: boolean }) => {
      const result = await saveArticleToArtifact({
        title: article.title,
        content: article.content,
        existingPath: article.filePath,
      });

      const snapshot = getArticleSnapshot(article);
      lastSavedSnapshotRef.current[result.filePath] = snapshot;

      setArticles((current) =>
        current.map((item) =>
          item.id === article.id
            ? {
                ...item,
                id: result.filePath,
                filePath: result.filePath,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      setActiveId((current) => (current === article.id ? result.filePath : current));
      void refreshTree();

      if (!options?.silent) {
        toast.success(t("articles.toast.savedToDisk", { path: result.relativePath }));
      }
    },
    [getArticleSnapshot, refreshTree, t],
  );

  const handleSave = async () => {
    if (!activeArticle) return;
    setIsSaving(true);
    try {
      await persistArticle(activeArticle, { silent: true });
      toast.success(t("articles.toast.saved"));
    } catch (e) {
      toast.error(t("articles.toast.saveToDiskFailed", { error: String(e) }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateArticle = async () => {
    const next = createArticle();
    setArticles((current) => [next, ...current]);
    setActiveId(next.id);
    setMode("write");
    try {
      await persistArticle(next, { silent: true });
      toast.success(t("articles.toast.created"));
    } catch (e) {
      toast.error(t("articles.toast.saveToDiskFailed", { error: String(e) }));
    }
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

  const openArticleFromPath = useCallback(
    async (path: string) => {
      if (!/\.md$/i.test(path)) {
        toast.message(t("articles.toast.onlyMarkdownEditable"));
        return;
      }

      try {
        const opened = await openArtifactArticle(path);
        setArticles((current) => {
          const next = createArticle({
            id: opened.filePath,
            title: opened.title,
            content: opened.content,
            updatedAt: opened.updatedAt,
            filePath: opened.filePath,
          });

          const byId = new Map<string, ArticleRecord>();
          for (const item of current) byId.set(item.id, item);
          byId.set(next.id, next);
          return Array.from(byId.values());
        });

        lastSavedSnapshotRef.current[opened.filePath] = getArticleSnapshot({
          title: opened.title,
          content: opened.content,
        });
        setActiveId(opened.filePath);
        setMode("write");
      } catch (e) {
        toast.error(t("articles.toast.openFailed", { error: String(e) }));
      }
    },
    [getArticleSnapshot, t],
  );

  useEffect(() => {
    if (!activeArticle) return;

    const snapshot = getArticleSnapshot(activeArticle);
    const savedKey = activeArticle.filePath ?? activeArticle.id;
    if (lastSavedSnapshotRef.current[savedKey] === snapshot) return;

    const timer = window.setTimeout(() => {
      setIsSaving(true);
      void persistArticle(activeArticle, { silent: true })
        .catch(() => {
          // Avoid interrupting typing with repeated autosave errors.
        })
        .finally(() => {
          setIsSaving(false);
        });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [activeArticle, getArticleSnapshot, persistArticle]);

  const handleShare = async () => {
    if (!activeArticle) return;
    try {
      await navigator.clipboard.writeText(activeArticle.content);
      toast.success(t("articles.toast.mdCopied"));
    } catch {
      toast.error(t("articles.toast.copyFailed"));
    }
  };

  const handlePublishToFeiniao = async () => {
    if (!activeArticle) return;
    const cfg = getImaKbConfig();
    if (!cfg.kbId) {
      setFeiniaoKbInputValue("");
      setFeiniaoFolderInputValue("");
      setFeiniaoKbDialogOpen(true);
      return;
    }
    setIsPublishingToFeiniao(true);
    try {
      const result = await importMarkdownToFeiniao(
        activeArticle.title,
        activeArticle.content,
        cfg.kbId,
        cfg.feiniaoFolderId || undefined,
      );
      if (result.success) {
        toast.success("已存入飞鸟");
        void loadFeiniaoArticles(cfg);
      } else {
        toast.error(`存入失败: ${result.error}`);
      }
    } catch (e) {
      toast.error(`存入失败: ${String(e)}`);
    } finally {
      setIsPublishingToFeiniao(false);
    }
  };

  const loadFeiniaoArticles = async (cfg = getImaKbConfig()) => {
    if (!cfg.kbId) return;
    setIsLoadingFeiniao(true);
    try {
      const items = await listFeiniaoArticles(cfg.kbId, cfg.feiniaoFolderId || undefined);
      setFeiniaoArticles(items);
    } catch {
      setFeiniaoArticles([]);
    } finally {
      setIsLoadingFeiniao(false);
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
  const viewButton = (active = false) =>
    cn(
      "flex size-7 items-center justify-center rounded-md transition-colors",
      active
        ? "bg-white text-[#7771e8] shadow-sm"
        : "text-slate-500 hover:text-slate-900"
    );

  return (
    <div className="flex h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.06),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      {/* ── LEFT COLUMN: toolbar + editor ──────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col border-r border-slate-100 bg-white/80 backdrop-blur">

        {/* Title row */}
        <div
          className="flex flex-shrink-0 items-center gap-3 border-b border-slate-100 px-3 py-2"
          data-tauri-drag-region
          style={{ WebkitAppRegion: "drag" } as CSSProperties}
        >
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5" style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
            <button type="button" onClick={() => onViewChange?.("chat")} title="CHAT" aria-label="CHAT" className={viewButton(activeView === "chat")}>
              <MessageSquareText className="size-3.5" />
            </button>
            <button type="button" onClick={() => onViewChange?.("editor")} title="EDIT" aria-label="EDIT" className={viewButton(activeView === "editor")}>
              <FilePenLine className="size-3.5" />
            </button>
          </div>
          <Input
            value={activeArticle.title}
            onChange={(e) => updateArticle({ title: e.target.value || i18n.t("articles.untitled", { ns: "pages" }) })}
            className="h-9 border-0 bg-transparent px-0 text-lg font-semibold tracking-tight text-slate-900 shadow-none placeholder:text-slate-300 focus-visible:ring-0"
            placeholder={t("articles.titlePlaceholder")}
            style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
          />
          <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="More"
                  aria-label="More"
                  className="flex size-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <MoreVertical className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={onToggleMaximize}>
                  <Maximize2 className="size-4" />
                  放大 / 还原
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onClose} variant="destructive">
                  <X className="size-4" />
                  关闭
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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

          <span className="mx-1.5 h-5 w-px bg-slate-200" />

          {/* Publish to 飞鸟 KB */}
          <button
            type="button"
            title="发布到飞鸟知识库"
            disabled={isPublishingToFeiniao}
            className={cn(tb(), "disabled:opacity-60")}
            onClick={() => void handlePublishToFeiniao()}
          >
            {isPublishingToFeiniao
              ? <LoaderCircle className="size-4 animate-spin" />
              : <BookMarked className="size-4" />}
          </button>
        </div>

        {/* 飞鸟 KB ID setup dialog — collect KB ID and folder ID */}
          {feiniaoKbDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="w-80 rounded-xl bg-white p-5 shadow-xl">
              <p className="mb-1 text-sm font-semibold text-slate-800">连接「文章资产」知识库</p>
              <p className="mb-3 text-xs text-slate-500">在 IMA 知识库设置中找到「文章资产」的 ID 及「飞鸟」文件夹的 ID</p>
              <label className="mb-1 block text-xs font-medium text-slate-600">文章资产 知识库 ID</label>
              <input
                type="text"
                value={feiniaoKbInputValue}
                onChange={(e) => setFeiniaoKbInputValue(e.target.value)}
                placeholder="知识库 ID"
                className="mb-3 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                autoFocus
              />
              <label className="mb-1 block text-xs font-medium text-slate-600">飞鸟 文件夹 ID（选填）</label>
              <input
                type="text"
                value={feiniaoFolderInputValue}
                onChange={(e) => setFeiniaoFolderInputValue(e.target.value)}
                placeholder="文件夹 ID（留空则保存到根目录）"
                className="mb-3 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-60"
                  disabled={!feiniaoKbInputValue.trim()}
                  onClick={() => {
                    const cfg = getImaKbConfig();
                    const next = { ...cfg, kbId: feiniaoKbInputValue.trim(), feiniaoFolderId: feiniaoFolderInputValue.trim() };
                    setImaKbConfig(next);
                    setFeiniaoKbDialogOpen(false);
                    void handlePublishToFeiniao();
                  }}
                >
                  保存并存入
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  onClick={() => setFeiniaoKbDialogOpen(false)}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Editor / Preview area */}
        <div className={cn("min-h-0 flex-1 overflow-hidden", mode === "split" ? "grid grid-cols-2" : "grid grid-cols-1")}>
          {/* The editor stays mounted at all times so switching modes never destroys
              and recreates the tiptap instance — doing that forced a lossy
              markdown -> ProseMirror -> markdown round-trip on every toggle,
              which compounded into corrupted formatting (e.g. everything bold)
              after switching modes a couple of times. We just hide it with CSS
              when the preview-only mode is active. */}
          <div
            className={cn(
              "min-w-0 h-full overflow-y-auto",
              mode === "split" && "border-r border-slate-100",
              mode === "preview" && "hidden"
            )}
          >
            <ArticleEditor
              content={activeArticle.content}
              onUpdate={handleEditorUpdate}
              onCreate={handleEditorCreate}
              onEditorReady={setEditor}
              onDropFile={handleDropFile}
              onPasteFile={handlePasteFile}
            />
          </div>
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
      <div className={cn(
        "w-72 flex-shrink-0 flex-col bg-white/70 backdrop-blur transition-all duration-300",
        isMaximized ? "hidden" : "flex"
      )}>

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
          <ArtifactTreeMenu
            roots={treeRoots}
            selectedFilePath={activeArticle.filePath}
            onSelectFile={(path) => {
              void openArticleFromPath(path);
            }}
            direction="rtl"
            showPath={false}
            onRefresh={() => {
              void refreshArticlesFromDisk();
            }}
          />
        </div>

        {/* Meta panel – scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-5 p-4">

            {/* 飞鸟 article list */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-widest text-slate-400">飞鸟文档</span>
                <button
                  type="button"
                  title="刷新飞鸟列表"
                  disabled={isLoadingFeiniao}
                  onClick={() => void loadFeiniaoArticles()}
                  className="flex size-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                >
                  {isLoadingFeiniao
                    ? <LoaderCircle className="size-3 animate-spin" />
                    : <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                  }
                </button>
              </div>
              {feiniaoArticles.length === 0 ? (
                <div
                  className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-4 text-xs text-slate-400 hover:border-indigo-200 hover:text-indigo-400"
                  onClick={() => void loadFeiniaoArticles()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && void loadFeiniaoArticles()}
                >
                  {isLoadingFeiniao ? "加载中…" : "点击加载飞鸟文档"}
                </div>
              ) : (
                <ul className="space-y-1">
                  {feiniaoArticles.map((item) => (
                    <li
                      key={item.id}
                      className="truncate rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                      title={item.title}
                    >
                      {item.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-slate-400">
                {t("articles.meta.currentArticle")}
              </div>
              <div className="truncate text-sm font-medium text-slate-700">
                {activeArticle.title || i18n.t("articles.untitled", { ns: "pages" })}
              </div>
              <div className="mt-1 break-all text-[11px] text-slate-400">
                {activeArticle.filePath ?? t("articles.meta.notSavedYet")}
              </div>
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
