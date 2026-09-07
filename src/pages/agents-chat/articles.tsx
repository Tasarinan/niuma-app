import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  FileInput,
  FileText,
  Heading1,
  Heading2,
  ImagePlus,
  Images,
  LayoutTemplate,
  Link2,
  List,
  ListOrdered,
  ListTree,
  LoaderCircle,
  Palette,
  PencilLine,
  Quote,
  Save,
  Sigma,
  Split,
  Table2,
  Undo2,
  Redo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  articleYamlPathFromArticle,
  parseDefaultFormatPreset,
  upsertDefaultFormatPreset,
} from "@/lib/wechat/article-yaml";
import {
  DEFAULT_FORMAT_THEME_ID,
  FORMAT_THEME_GROUPS,
  formatThemeById,
  formatThemesByGroup,
  isKnownFormatTheme,
} from "@/lib/wechat/format-themes";
import { loadFormatThemeStyles } from "@/lib/wechat/load-format-theme";
import { openArtifactArticle, saveArticleToArtifact, scanArtifactArticles } from "@/lib/artifact/article-repo";
import { subscribeOpenWorkbenchArticle, subscribeDraftFileChanged } from "@/lib/artifact/open-workbench-article";
import { ArticleEditor } from "@/components/article-editor/ArticleEditor";
import { ArticleBlockPresetPanel } from "@/components/article-editor/ArticleBlockPresetPanel";
import { ArticleOutline } from "@/components/article-editor/ArticleOutline";
import { BlockStylePanel } from "@/components/article-editor/BlockStylePanel";
import { loadArticleMarkdown } from "@/components/article-editor/set-markdown";
import { DraftImagePanel } from "@/components/article-editor/DraftImagePanel";
import { fillArticleBlockPlaceholders, type ArticleBlockPreset } from "@/lib/content/article-block-presets";
import { WechatThemePreview } from "@/components/article-editor/WechatThemePreview";

import {
  draftFolderFromFilePath,
  draftImageStem,
  formatDraftImagePromptMarkdown,
  loadDraftImageGallery,
  nextDraftImageFilename,
  pickOpenManuscriptContent,
  promptMarkdownAbsPath,
  resolveDiskSyncAction,
  type DraftGalleryItem,
} from "@/lib/artifact/draft-workspace";
import { readBinaryBase64, readText, writeBinary, writeText } from "@/lib/artifact/fs";
import {
  inlineLocalMarkdownImages,
  relativizeMarkdownImages,
} from "@/lib/artifact/markdown-images";
import { encodePngInBrowser, ensurePngBytes, materializeLocalImagesAsPng, toPngPath } from "@/lib/artifact/png-images";
import {
  draftThemeSlugFromFolder,
  inferImageNameIntent,
  isScreenshotLikeFilename,
  normalizeWechatImageFilename,
} from "@/lib/artifact/draft-image-names";
import { generateProviderImage } from "@/lib/providers/media";
import {
  isPlaceholderArticleTitle,
  loadUnpublishedDrafts,
  pickDefaultDraftOpenPath,
  selectOpenArticle,
} from "@/lib/artifact/unpublished-drafts";
import { LAST_OPEN_DRAFT_KEY, displayPathUnderDrafts, normalizeDraftPath, sameManuscriptPath, toDraftArticlePath } from "@/lib/artifact/drafts";
import {
  persistStoredArticles,
  readLastOpenDraftPath,
  readStoredArticles,
} from "@/lib/artifact/article-storage";
import { useArticleArtifactTree } from "@/hooks/useArticleArtifactTree";
import { importMarkdownToFeiniao } from "@/lib/functions/ima.api";
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
type EditorRightPanel = "outline" | "templates" | "images" | "style" | "meta";
type WorkbenchView = "chat" | "editor";

const RIGHT_PANEL_TITLE: Record<EditorRightPanel, string> = {
  outline: "大纲",
  templates: "模板",
  images: "配图",
  style: "样式",
  meta: "稿件信息",
};

interface ArticlesPageProps {
  activeView?: WorkbenchView;
  onOpenFileChange?: (path?: string) => void;
}

function createArticle(partial?: Partial<ArticleRecord>): ArticleRecord {
  const now = new Date().toISOString();
  return {
    id: partial?.id ?? crypto.randomUUID(),
    title: partial?.title ?? "",
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
  return readStoredArticles<ArticleRecord>()
    .map((item) => createArticle(item))
    .filter((item) => !(isPlaceholderArticleTitle(item.title) && !item.content.trim()));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

function initialActiveId(stored: ArticleRecord[]): string {
  const last = readLastOpenDraftPath();
  if (last) {
    const match = stored.find((item) => item.filePath && sameManuscriptPath(item.filePath, last));
    if (match) return match.id;
    return last;
  }
  return stored[0]?.id ?? "";
}

export default function ArticlesPage({
  activeView = "editor",
  onOpenFileChange,
}: ArticlesPageProps = {}) {
  const { refreshTree } = useArticleArtifactTree();
  const coverPanelRef = useRef<HTMLDivElement>(null);
  const [articles, setArticles] = useState<ArticleRecord[]>(() => readArticles());
  const [activeId, setActiveId] = useState<string>(() => initialActiveId(readArticles()));
  const [mode, setMode] = useState<EditorMode>("write");
  const [markdownSource, setMarkdownSource] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishingToFeiniao, setIsPublishingToFeiniao] = useState(false);
  const [feiniaoKbDialogOpen, setFeiniaoKbDialogOpen] = useState(false);
  const [feiniaoKbInputValue, setFeiniaoKbInputValue] = useState("");
  const [feiniaoFolderInputValue, setFeiniaoFolderInputValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeIdRef = useRef(activeId);
  const lastSavedSnapshotRef = useRef<Record<string, string>>({});
  const lastSavedContentRef = useRef<Record<string, string>>({});
  const editorRef = useRef<Editor | null>(null);
  const activeArticleRef = useRef<ArticleRecord | null>(null);
  const [galleryItems, setGalleryItems] = useState<DraftGalleryItem[]>([]);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [generateName, setGenerateName] = useState("cover.png");
  const [generateTargetId, setGenerateTargetId] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<EditorRightPanel | null>(null);
  const [formatThemeId, setFormatThemeId] = useState(DEFAULT_FORMAT_THEME_ID);
  const [themeStyles, setThemeStyles] = useState<Record<string, string> | null>(null);
  const [conflictDisk, setConflictDisk] = useState<string | null>(null);
  const lastSaveErrorToastAtRef = useRef(0);
  // Tracks whether a setContent call is in-flight so onUpdate skips writing
  // back to articles state and avoids an infinite loop.
  const isSettingContentRef = useRef(false);
  const imageSrcMapRef = useRef(new Map<string, string>());
  const markdownLoadGenRef = useRef(0);
  const openGenRef = useRef(0);
  const humanEditedRef = useRef(false);
  const intendedPathRef = useRef<string | undefined>(readLastOpenDraftPath());
  const loadedPathRef = useRef<string | undefined>(undefined);
  const [editor, setEditor] = useState<Editor | null>(null);
  const { t } = useTranslation("pages");

  const activeArticle = useMemo(() => {
    return selectOpenArticle(articles, activeId);
  }, [activeId, articles]);
  activeArticleRef.current = activeArticle;
  activeIdRef.current = activeId;

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    activeArticleRef.current = activeArticle;
  }, [activeArticle]);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    const path = activeArticle?.filePath;
    onOpenFileChange?.(path ? toDraftArticlePath(path) : undefined);
  }, [activeArticle?.filePath, onOpenFileChange]);

  const applyMarkdownToEditor = useCallback(async (markdown: string, filePath?: string) => {
    const path = filePath ?? activeArticleRef.current?.filePath;
    const loadGen = ++markdownLoadGenRef.current;
    isSettingContentRef.current = true;
    imageSrcMapRef.current = new Map();
    const { markdown: display, srcMap } = await inlineLocalMarkdownImages(
      markdown,
      path,
      readBinaryBase64,
    );
    if (loadGen !== markdownLoadGenRef.current) return;
    imageSrcMapRef.current = srcMap;
    loadedPathRef.current = path;
    const currentEditor = editorRef.current;
    if (!currentEditor) {
      setMarkdownSource(display);
      isSettingContentRef.current = false;
      return;
    }
    loadArticleMarkdown(currentEditor, display);
    setMarkdownSource(display);
    requestAnimationFrame(() => {
      if (loadGen !== markdownLoadGenRef.current) return;
      isSettingContentRef.current = false;
    });
  }, []);

  const refreshGallery = useCallback(async (path?: string) => {
    if (!path) {
      setGalleryItems([]);
      return;
    }
    let items: DraftGalleryItem[] = [];
    try {
      items = await loadDraftImageGallery(path);
    } catch (error) {
      setGalleryItems([]);
      toast.error(`配图加载失败: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    setGalleryItems(items);
    const cover =
      items.find((item) => /^cover\./i.test(item.name) && item.dataUrl)?.dataUrl ||
      items.find((item) => /封面/.test(item.title) && item.dataUrl)?.dataUrl ||
      items.find((item) => item.dataUrl)?.dataUrl;
    if (!cover) return;
    setArticles((current) =>
      current.map((article) =>
        article.filePath === path && !article.cover ? { ...article, cover } : article,
      ),
    );
  }, []);

  const syncOpenFileFromDisk = useCallback(async () => {
    const article = activeArticleRef.current;
    if (!article?.filePath) return;
    if (intendedPathRef.current && !sameManuscriptPath(article.filePath, intendedPathRef.current)) {
      return;
    }
    let disk = "";
    try {
      disk = await readText(article.filePath);
    } catch {
      return;
    }
    const saved = lastSavedContentRef.current[article.filePath] ?? "";
    const action = resolveDiskSyncAction({
      humanEdited: humanEditedRef.current,
      editorContent: article.content,
      diskContent: disk,
      lastSavedContent: saved,
    });
    if (action === "keep") {
      setConflictDisk(null);
      return;
    }
    if (action === "apply-disk") {
      setConflictDisk(null);
      humanEditedRef.current = false;
      lastSavedContentRef.current[article.filePath] = disk;
      lastSavedSnapshotRef.current[article.filePath] = JSON.stringify({
        title: article.title,
        content: disk,
      });
      setArticles((current) =>
        current.map((item) => (item.id === article.id ? { ...item, content: disk } : item)),
      );
      applyMarkdownToEditor(disk);
      return;
    }
    setConflictDisk(disk);
  }, [applyMarkdownToEditor]);

  const handleEditorUpdate = useCallback((content: string) => {
    if (isSettingContentRef.current) return;
    humanEditedRef.current = true;
    if (
      loadedPathRef.current &&
      activeIdRef.current &&
      !sameManuscriptPath(loadedPathRef.current, activeIdRef.current)
    ) {
      return;
    }
    const disk = relativizeMarkdownImages(content, imageSrcMapRef.current);
    const heading = disk.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
    setMarkdownSource(content);
    setArticles((current) =>
      current.map((article) =>
        article.id === activeIdRef.current
          ? {
              ...article,
              content: disk,
              title: heading || article.title,
              updatedAt: new Date().toISOString(),
            }
          : article
      )
    );
    const current = activeArticleRef.current;
    if (current && current.id === activeIdRef.current) {
      activeArticleRef.current = {
        ...current,
        content: disk,
        title: heading || current.title,
        updatedAt: new Date().toISOString(),
      };
    }
  }, []);

  const handleEditorCreate = useCallback((content: string) => {
    setMarkdownSource(content);
  }, []);

  const saveGalleryImage = useCallback(
    async (name: string, bytes: Uint8Array, title?: string) => {
      const article = activeArticleRef.current;
      if (!article?.filePath) {
        toast.message("请先打开一篇已定题的稿。");
        return;
      }
      const folder = draftFolderFromFilePath(article.filePath);
      if (!folder) {
        toast.message("请先打开一篇已定题的稿。");
        return;
      }
      const existing = galleryItems.map((item) => item.name);
      const themeSlug = draftThemeSlugFromFolder(folder);
      const rawName = name.replace(/^.*[\\/]/, "") || "01.png";
      const intent = inferImageNameIntent(rawName);
      const pngName = normalizeWechatImageFilename(
        toPngPath(rawName, existing, { themeSlug, intent }),
        existing,
        { themeSlug, intent },
      );
      const png = await ensurePngBytes(bytes, encodePngInBrowser);
      const dest = `${folder}/imgs/${pngName}`;
      await writeBinary(dest, png);
      if (/^cover\.png$/i.test(pngName)) {
        const dataUrl = await fileToDataUrl(new File([png], pngName, { type: "image/png" }));
        updateArticle({ cover: dataUrl });
      }
      await refreshGallery(article.filePath);
      toast.success(title ? `已保存「${title}」` : "配图已保存");
      return { name: pngName, dest, bytes: png };
    },
    [refreshGallery],
  );

  const persistPngFromFile = useCallback(
    async (file: File) => {
      const existing = galleryItems.map((item) => item.name);
      const article = activeArticleRef.current;
      const folder = article?.filePath ? draftFolderFromFilePath(article.filePath) : null;
      const themeSlug = folder ? draftThemeSlugFromFolder(folder) : undefined;
      const intent = inferImageNameIntent(file.name);
      const suggested = /\.(png|jpe?g|jfif|gif|webp)$/i.test(file.name)
        ? toPngPath(file.name, existing, {
            themeSlug,
            intent: isScreenshotLikeFilename(file.name) ? "inline" : intent,
          })
        : nextDraftImageFilename(existing, { intent, themeSlug });
      const saved = await saveGalleryImage(suggested, new Uint8Array(await file.arrayBuffer()), file.name);
      if (!saved) return;
      const dataUrl = await fileToDataUrl(new File([saved.bytes], saved.name, { type: "image/png" }));
      imageSrcMapRef.current.set(dataUrl, `imgs/${saved.name}`);
      return { name: saved.name, dataUrl };
    },
    [galleryItems, saveGalleryImage],
  );

  const handleDropFile = useCallback(async (editorInstance: Editor, files: File[], position: number) => {
    for (const file of files) {
      const inserted = await persistPngFromFile(file);
      if (!inserted) continue;
      editorInstance.chain().focus().insertContentAt(position, {
        type: "image",
        attrs: { src: inserted.dataUrl, alt: inserted.name },
      }).run();
    }
  }, [persistPngFromFile]);

  const handlePasteFile = useCallback(async (editorInstance: Editor, files: File[]) => {
    for (const file of files) {
      const inserted = await persistPngFromFile(file);
      if (!inserted) continue;
      editorInstance.chain().focus().setImage({ src: inserted.dataUrl, alt: inserted.name }).run();
    }
  }, [persistPngFromFile]);

  // Reload the TipTap document whenever the open manuscript path (or editor
  // instance) changes. Do not compare markdown here — old inlined images can
  // look similar to a new draft's imgs/cover.png and skip the swap.
  useEffect(() => {
    if (!editor || !activeArticle) return;
    void applyMarkdownToEditor(activeArticle.content || "", activeArticle.filePath);
    // Content is owned by disk sync / openArticleFromPath. Reloading on every
    // keystroke would wipe undo and jump the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeArticle?.filePath, editor, applyMarkdownToEditor]);

  useEffect(() => {
    persistStoredArticles(articles);
  }, [articles]);

  const getArticleSnapshot = useCallback((article: Pick<ArticleRecord, "title" | "content" | "summary">) => {
    return JSON.stringify({
      title: article.title,
      content: article.content,
      summary: article.summary,
    });
  }, []);

  const refreshArticlesFromDisk = useCallback(async () => {
    try {
      const scanned = await scanArtifactArticles();
      if (!scanned.length) return;

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
        const openPath = activeArticleRef.current?.filePath;
        for (const item of fromDisk) {
          // The open manuscript is owned by buffer sync, not the catalog scan.
          if (openPath && sameManuscriptPath(item.filePath, openPath)) continue;
          const existing =
            byId.get(item.id) ??
            [...byId.values()].find((record) => sameManuscriptPath(record.filePath, item.filePath));
          if (existing) {
            const snapshot = getArticleSnapshot(existing);
            const keys = [existing.filePath, existing.id, item.filePath].filter(
              (key): key is string => Boolean(key),
            );
            const dirty = keys.every((key) => lastSavedSnapshotRef.current[key] !== snapshot);
            if (dirty) continue;
          }
          byId.set(existing?.id ?? item.id, existing ? { ...existing, ...item, id: existing.id } : item);
          if (item.filePath) {
            lastSavedSnapshotRef.current[item.filePath] = getArticleSnapshot({
              title: item.title,
              content: item.content,
            });
            lastSavedContentRef.current[item.filePath] = item.content;
          }
        }
        return Array.from(byId.values());
      });

      setActiveId((prev) => {
        if (prev && scanned.some((item) => item.filePath === prev)) return prev;
        return prev;
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
    if (!activeArticle?.filePath) return;
    void refreshArticlesFromDisk();
    void syncOpenFileFromDisk();
    const timer = window.setInterval(() => {
      void refreshArticlesFromDisk();
      void syncOpenFileFromDisk();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [activeArticle?.filePath, refreshArticlesFromDisk, syncOpenFileFromDisk]);

  useEffect(() => {
    if (activeView !== "editor") return;
    void refreshArticlesFromDisk();
    void syncOpenFileFromDisk();
  }, [activeView, refreshArticlesFromDisk, syncOpenFileFromDisk]);

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  useEffect(() => {
    const handleFocus = () => {
      void refreshArticlesFromDisk();
      void syncOpenFileFromDisk();
      void refreshTree();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshArticlesFromDisk, refreshTree, syncOpenFileFromDisk]);

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
      const live = (() => {
        const instance = editorRef.current;
        if (!instance || isSettingContentRef.current) return article.content;
        try {
          return relativizeMarkdownImages(instance.getMarkdown(), imageSrcMapRef.current);
        } catch {
          return article.content;
        }
      })();
      const result = await saveArticleToArtifact({
        title: article.title,
        content: live,
        summary: article.summary,
        existingPath: article.filePath,
      });

      const snapshot = getArticleSnapshot({ title: article.title, content: live, summary: article.summary });
      lastSavedSnapshotRef.current[result.filePath] = snapshot;
      lastSavedContentRef.current[result.filePath] = live;
      if (article.filePath && article.filePath !== result.filePath) {
        lastSavedSnapshotRef.current[article.filePath] = snapshot;
        lastSavedContentRef.current[article.filePath] = live;
      }

      setArticles((current) =>
        current.map((item) =>
          item.id === article.id || sameManuscriptPath(item.filePath, article.filePath)
            ? {
                ...item,
                id: result.filePath,
                filePath: result.filePath,
                content: live,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      setActiveId((current) =>
        current === article.id || sameManuscriptPath(current, article.filePath) ? result.filePath : current,
      );
      void refreshTree();

      if (!options?.silent) {
        toast.success(t("articles.toast.savedToDisk", { path: result.relativePath }));
      }
    },
    [getArticleSnapshot, refreshTree, t],
  );

  const handleSave = async () => {
    if (!activeArticle) return;
    if (!activeArticle.filePath) {
      toast.message("请先在聊天里用 /wechat 让主理人确认选题。讨论阶段不创建文档。");
      return;
    }
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
      const title = file.name.replace(/\.md$/i, "");
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
      const inserted = await persistPngFromFile(file);
      if (!inserted) return;
      editor.chain().focus().setImage({ src: inserted.dataUrl, alt: inserted.name }).run();
      toast.success(t("articles.toast.imageInserted"));
    } catch {
      toast.error(t("articles.toast.imageReadFailed"));
    }
  };

  const openArticleFromPath = useCallback(
    async (path: string, options?: { silent?: boolean }): Promise<boolean> => {
      if (!/\.md$/i.test(path)) {
        if (!options?.silent) toast.message(t("articles.toast.onlyMarkdownEditable"));
        return false;
      }
      const target = /\/review\.md$/i.test(path.replace(/\\/g, "/"))
        ? normalizeDraftPath(path)
        : toDraftArticlePath(path);
      const openGen = ++openGenRef.current;
      intendedPathRef.current = target;
      humanEditedRef.current = false;
      isSettingContentRef.current = true;
      setGalleryItems([]);

      try {
        const opened = await openArtifactArticle(target);
        if (openGen !== openGenRef.current) return false;
        let content = opened.content;
        try {
          const materialized = await materializeLocalImagesAsPng({
            articlePath: opened.filePath,
            markdown: opened.content,
            readBase64: readBinaryBase64,
            writeBytes: writeBinary,
          });
          if (openGen !== openGenRef.current) return false;
          content = materialized.markdown;
          if (content !== opened.content) {
            await writeText(opened.filePath, content);
          }
        } catch {
          content = opened.content;
        }
        if (openGen !== openGenRef.current) return false;
        const existing = activeArticleRef.current;
        const diskContent = content;
        if (existing && sameManuscriptPath(existing.filePath, opened.filePath)) {
          content = pickOpenManuscriptContent({
            diskContent,
            memoryContent: existing.content,
            lastSavedContent:
              lastSavedContentRef.current[opened.filePath] ??
              lastSavedContentRef.current[existing.filePath ?? ""] ??
              "",
          });
        }
        const next = createArticle({
          id: opened.filePath,
          title: opened.title,
          summary: opened.summary,
          content,
          updatedAt: opened.updatedAt,
          filePath: opened.filePath,
        });
        setArticles((current) => {
          const byId = new Map<string, ArticleRecord>();
          for (const item of current) {
            if (sameManuscriptPath(item.filePath, opened.filePath)) continue;
            byId.set(item.id, item);
          }
          byId.set(next.id, next);
          return Array.from(byId.values());
        });

        lastSavedSnapshotRef.current[opened.filePath] = getArticleSnapshot({
          title: opened.title,
          content: diskContent,
          summary: opened.summary,
        });
        lastSavedContentRef.current[opened.filePath] = diskContent;
        setConflictDisk(null);
        setActiveId(opened.filePath);
        setMode("write");
        activeArticleRef.current = next;
        loadedPathRef.current = opened.filePath;
        try {
          window.localStorage.setItem(LAST_OPEN_DRAFT_KEY, toDraftArticlePath(opened.filePath));
        } catch {
          // ignore
        }
        void refreshGallery(opened.filePath);
        await applyMarkdownToEditor(content, opened.filePath);
        return true;
      } catch (e) {
        if (openGen === openGenRef.current) isSettingContentRef.current = false;
        if (!options?.silent) {
          toast.error(t("articles.toast.openFailed", { error: String(e) }));
        }
        return false;
      }
    },
    [applyMarkdownToEditor, getArticleSnapshot, refreshGallery, t],
  );

  useEffect(() => {
    void refreshGallery(activeArticle?.filePath);
  }, [activeArticle?.filePath, refreshGallery]);

  useEffect(() => {
    if (rightPanel !== "images") return;
    void refreshGallery(activeArticleRef.current?.filePath);
  }, [rightPanel, refreshGallery]);

  useEffect(() => {
    const filePath = activeArticle?.filePath;
    const yamlPath = filePath ? articleYamlPathFromArticle(filePath) : null;
    if (!yamlPath) {
      setFormatThemeId(DEFAULT_FORMAT_THEME_ID);
      return;
    }
    let cancelled = false;
    void readText(yamlPath)
      .then((text) => {
        if (cancelled) return;
        setFormatThemeId(parseDefaultFormatPreset(text) || DEFAULT_FORMAT_THEME_ID);
      })
      .catch(() => {
        if (!cancelled) setFormatThemeId(DEFAULT_FORMAT_THEME_ID);
      });
    return () => {
      cancelled = true;
    };
  }, [activeArticle?.filePath]);

  useEffect(() => {
    let cancelled = false;
    void loadFormatThemeStyles(formatThemeId)
      .then((styles) => {
        if (!cancelled) setThemeStyles(styles);
      })
      .catch(() => {
        if (!cancelled) setThemeStyles(null);
      });
    return () => {
      cancelled = true;
    };
  }, [formatThemeId]);

  const handleFormatThemeChange = async (themeId: string) => {
    setFormatThemeId(themeId);
    const yamlPath = activeArticle?.filePath
      ? articleYamlPathFromArticle(activeArticle.filePath)
      : null;
    if (!yamlPath) return;
    try {
      let existing = "";
      try {
        existing = await readText(yamlPath);
      } catch {
        existing = "";
      }
      await writeText(yamlPath, upsertDefaultFormatPreset(existing, themeId));
    } catch {
      toast.error("保存排版样式失败");
    }
  };

  useEffect(() => {
    const path = activeArticle?.filePath;
    if (path && lastSavedContentRef.current[path] === undefined) {
      lastSavedContentRef.current[path] = activeArticle.content;
    }
  }, [activeArticle?.filePath, activeArticle?.content]);

  const applyDiskVersion = useCallback(() => {
    const article = activeArticleRef.current;
    if (!article?.filePath || conflictDisk == null) return;
    humanEditedRef.current = false;
    lastSavedContentRef.current[article.filePath] = conflictDisk;
    lastSavedSnapshotRef.current[article.filePath] = JSON.stringify({
      title: article.title,
      content: conflictDisk,
    });
    setArticles((current) =>
      current.map((item) => (item.id === article.id ? { ...item, content: conflictDisk } : item)),
    );
    applyMarkdownToEditor(conflictDisk);
    setConflictDisk(null);
  }, [applyMarkdownToEditor, conflictDisk]);

  const keepHumanVersion = useCallback(() => {
    const article = activeArticleRef.current;
    if (!article?.filePath) {
      setConflictDisk(null);
      return;
    }
    void persistArticle(article, { silent: true }).finally(() => setConflictDisk(null));
  }, [persistArticle]);

  const handleUploadGalleryImage = useCallback(
    async (file: File) => {
      await persistPngFromFile(file);
    },
    [persistPngFromFile],
  );

  const openGenerateDialog = useCallback((item?: DraftGalleryItem) => {
    const existing = galleryItems.map((entry) => entry.name);
    setGenerateTargetId(item?.id ?? null);
    setGenerateName(toPngPath(item?.name || nextDraftImageFilename(existing)));
    setGeneratePrompt(
      item?.prompt
      || galleryItems.find((entry) => entry.prompt)?.prompt
      || "",
    );
    setGenerateOpen(true);
  }, [galleryItems]);

  const handleGenerateGalleryImage = useCallback(async () => {
    const prompt = generatePrompt.trim();
    if (!prompt) {
      toast.message("请先填写参考 Prompt。");
      return;
    }
    const name = toPngPath(generateName.trim() || "cover.png");
    setGeneratingId(generateTargetId ?? name);
    setGenerateOpen(false);
    try {
      const reference = galleryItems.find((item) => item.id === generateTargetId)?.dataUrl;
      const bytes = await generateProviderImage({
        prompt,
        referenceDataUrl: reference,
      });
      const saved = await saveGalleryImage(name, bytes, name);
      if (saved) {
        await writeText(
          promptMarkdownAbsPath(saved.dest),
          formatDraftImagePromptMarkdown({
            title: galleryItems.find((item) => item.id === generateTargetId)?.title || draftImageStem(saved.name),
            filename: saved.name,
            prompt,
          }),
        );
        await refreshGallery(activeArticleRef.current?.filePath);
      }
    } catch (error) {
      toast.error(`生成失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setGeneratingId(null);
    }
  }, [galleryItems, generateName, generatePrompt, generateTargetId, refreshGallery, saveGalleryImage]);

  const handleInsertGalleryImage = useCallback((item: DraftGalleryItem) => {
    if (!item.dataUrl || !editor) return;
    if (item.relativeSrc) imageSrcMapRef.current.set(item.dataUrl, toPngPath(item.relativeSrc));
    editor.chain().focus().setImage({ src: item.dataUrl, alt: item.title }).run();
    toast.success("已插入正文");
  }, [editor]);

  const handleInsertArticleBlock = useCallback(
    (preset: ArticleBlockPreset) => {
      if (!editor) {
        toast.message("先打开一篇稿再插入模板。");
        return;
      }
      const filled = fillArticleBlockPlaceholders(preset.markdown, {
        title: activeArticleRef.current?.title ?? "",
      });
      editor
        .chain()
        .focus()
        .insertContent(`${filled.trim()}\n\n`, { contentType: "markdown" })
        .run();
      toast.success(`已插入「${preset.name}」`);
    },
    [editor],
  );

  const needsDefaultDraft = (article: ArticleRecord | null) => {
    if (!article?.filePath) return true;
    const path = article.filePath.replace(/\\/g, "/").toLowerCase();
    if (!path.includes(".artifacts/drafts/") || !path.endsWith("/article.md")) return true;
    return isPlaceholderArticleTitle(article.title) || !article.content.trim();
  };

  const ensureDefaultDraftOpen = useCallback(async () => {
    const intended = intendedPathRef.current ?? readLastOpenDraftPath();
    const current = activeArticleRef.current?.filePath;
    if (intended) {
      if (!current || !sameManuscriptPath(current, intended) || needsDefaultDraft(activeArticleRef.current)) {
        await openArticleFromPath(intended, { silent: true });
      }
      return;
    }
    if (!needsDefaultDraft(activeArticleRef.current)) return;
    const drafts = await loadUnpublishedDrafts().catch(() => []);
    const fallback = pickDefaultDraftOpenPath(drafts);
    if (fallback) await openArticleFromPath(fallback, { silent: true });
  }, [openArticleFromPath]);

  useEffect(() => {
    void ensureDefaultDraftOpen();
  }, [ensureDefaultDraftOpen]);

  useEffect(() => {
    if (activeView !== "editor") return;
    void ensureDefaultDraftOpen();
  }, [activeView, ensureDefaultDraftOpen]);

  useEffect(() => subscribeOpenWorkbenchArticle((detail) => {
    intendedPathRef.current = toDraftArticlePath(detail.filePath);
    void openArticleFromPath(detail.filePath, { silent: true }).then(() => {
      if (activeView !== "editor") return;
      if (detail.focus === "images") {
        setRightPanel("images");
      }
    });
  }), [activeView, openArticleFromPath]);

  useEffect(() => subscribeDraftFileChanged((detail) => {
    const open = activeArticleRef.current?.filePath;
    if (!open || !sameManuscriptPath(open, detail.filePath)) return;
    void syncOpenFileFromDisk();
  }), [syncOpenFileFromDisk]);

  useEffect(() => {
    if (!activeArticle?.filePath) return;

    const snapshot = getArticleSnapshot(activeArticle);
    const savedKey = activeArticle.filePath ?? activeArticle.id;
    if (lastSavedSnapshotRef.current[savedKey] === snapshot) return;

    const timer = window.setTimeout(() => {
      setIsSaving(true);
      void persistArticle(activeArticle, { silent: true })
        .then(() => {
          lastSaveErrorToastAtRef.current = 0;
        })
        .catch((error) => {
          const now = Date.now();
          if (now - lastSaveErrorToastAtRef.current < 8000) return;
          lastSaveErrorToastAtRef.current = now;
          toast.error(t("articles.toast.saveToDiskFailed", { error: String(error) }));
        })
        .finally(() => {
          setIsSaving(false);
        });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [activeArticle, getArticleSnapshot, persistArticle, t]);

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
      } else {
        toast.error(`存入失败: ${result.error}`);
      }
    } catch (e) {
      toast.error(`存入失败: ${String(e)}`);
    } finally {
      setIsPublishingToFeiniao(false);
    }
  };

  // ── Icon-only toolbar button style ──────────────────────────────────────────
  const tb = (active = false) =>
    cn(
      "inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-40",
      active
        ? "bg-indigo-100 text-indigo-700"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    );

  return (
    <div className="flex h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.06),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      {/* ── CENTER: editor body */}
      <div className="flex min-w-0 flex-1 flex-col bg-white/80 backdrop-blur">

        {!activeArticle ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-8 text-center text-sm leading-relaxed text-slate-400">
            还没有打开一篇已定题的稿。切到对话用 /wechat 确认选题。
          </div>
        ) : (
          <>
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
          <button
            type="button"
            title="撤销"
            className={tb()}
            disabled={!editor?.can().undo()}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            title="重做"
            className={tb()}
            disabled={!editor?.can().redo()}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 className="size-4" />
          </button>
          {/* Download */}
          <button type="button" title={t("articles.toolbar.downloadMd")} className={tb()} onClick={handleExportMarkdown}>
            <Download className="size-4" />
          </button>
          <button type="button" title={t("articles.toolbar.copyClipboard")} className={tb()} onClick={() => void handleShare()}>
            <Clipboard className="size-4" />
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

          <span className="mx-1.5 ml-auto h-5 w-px bg-slate-200" />

          <button type="button" title="大纲" className={tb(rightPanel === "outline")} onClick={() => setRightPanel((current) => current === "outline" ? null : "outline")}>
            <ListTree className="size-4" />
          </button>
          <button type="button" title="模板" className={tb(rightPanel === "templates")} onClick={() => setRightPanel((current) => current === "templates" ? null : "templates")}>
            <LayoutTemplate className="size-4" />
          </button>
          <button type="button" title="配图" className={tb(rightPanel === "images")} onClick={() => setRightPanel((current) => current === "images" ? null : "images")}>
            <Images className="size-4" />
          </button>
          <button type="button" title="样式" className={tb(rightPanel === "style")} onClick={() => setRightPanel((current) => current === "style" ? null : "style")}>
            <Palette className="size-4" />
          </button>
          <button type="button" title="稿件信息" className={tb(rightPanel === "meta")} onClick={() => setRightPanel((current) => current === "meta" ? null : "meta")}>
            <FileText className="size-4" />
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

        {conflictDisk != null && (
          <div className="flex flex-shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
            <span className="min-w-0 flex-1 leading-relaxed">
              磁盘上的稿件与你正在编辑的内容不一致。应用磁盘会覆盖编辑器；保留我的会写回磁盘。
            </span>
            <button
              type="button"
              className="shrink-0 rounded-md bg-white px-2 py-1 font-medium text-amber-950 shadow-sm hover:bg-amber-100"
              onClick={applyDiskVersion}
            >
              应用磁盘
            </button>
            <button
              type="button"
              className="shrink-0 rounded-md bg-amber-800 px-2 py-1 font-medium text-white hover:bg-amber-900"
              onClick={keepHumanVersion}
            >
              保留我的
            </button>
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
              key={activeArticle.filePath ?? activeArticle.id}
              content=""
              onUpdate={handleEditorUpdate}
              onCreate={handleEditorCreate}
              onEditorReady={setEditor}
              onDropFile={handleDropFile}
              onPasteFile={handlePasteFile}
            />
          </div>
          {mode !== "write" && (
            <div className={cn("min-w-0 overflow-y-auto", "bg-slate-200/70")}>
              <div className="mx-auto max-w-[780px] px-4 py-6">
                <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-widest text-slate-400">
                  预览 · {formatThemeById(formatThemeId)?.name ?? formatThemeId}
                </p>
                <WechatThemePreview
                  markdown={markdownSource}
                  themeId={formatThemeId}
                  styles={themeStyles}
                  articlePath={activeArticle?.filePath}
                />
              </div>
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {/* ── RIGHT: one panel at a time, opened from toolbar icons */}
      {rightPanel ? (
      <div className="flex w-72 flex-shrink-0 flex-col border-l border-slate-100 bg-white/70 backdrop-blur">
        <div className="flex h-10 flex-shrink-0 items-center border-b border-slate-100 px-3 text-[11px] font-medium uppercase tracking-widest text-slate-400">
          {RIGHT_PANEL_TITLE[rightPanel]}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 p-3">
            {rightPanel === "outline" ? <ArticleOutline editor={editor} embedded /> : null}
            {rightPanel === "style" ? <BlockStylePanel editor={editor} embedded /> : null}
            {rightPanel === "templates" ? (
              <ArticleBlockPresetPanel
                embedded
                disabled={!editor}
                onInsert={handleInsertArticleBlock}
              />
            ) : null}
            {rightPanel === "images" ? (
              <DraftImagePanel
                embedded
                items={galleryItems}
                disabled={!activeArticle?.filePath}
                generatingId={generatingId}
                onUpload={(file) => void handleUploadGalleryImage(file)}
                onGenerate={openGenerateDialog}
                onInsert={handleInsertGalleryImage}
              />
            ) : null}
            {rightPanel === "meta" ? (
              <div className="space-y-5">
            {!activeArticle ? (
              <p className="px-1 text-xs leading-relaxed text-slate-400">
                打开一篇稿后可在这里填写封面、摘要和标签。
              </p>
            ) : (
            <>
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-slate-400">
                {t("articles.meta.currentArticle")}
              </div>
              <p className="break-all font-mono text-xs leading-relaxed text-slate-700">
                {displayPathUnderDrafts(activeArticle.filePath) ?? "尚未落盘"}
              </p>
            </div>

            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-slate-400">
                标题
              </div>
              <Input
                value={activeArticle.title}
                onChange={(e) => updateArticle({ title: e.target.value })}
                placeholder={t("articles.titlePlaceholder")}
                className="h-8 rounded-xl text-sm"
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                与正文一级标题联动；保存时写入 article.yaml 的 title。
              </p>
            </div>

            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-slate-400">
                排版样式
              </div>
              <Select
                value={formatThemeId}
                onValueChange={(value) => void handleFormatThemeChange(value)}
                disabled={!activeArticle.filePath}
              >
                <SelectTrigger size="sm" className="h-8 w-full rounded-xl text-sm">
                  <SelectValue placeholder="选择排版样式" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {!isKnownFormatTheme(formatThemeId) && formatThemeId ? (
                    <SelectItem value={formatThemeId}>{formatThemeId}</SelectItem>
                  ) : null}
                  {FORMAT_THEME_GROUPS.map((group) => (
                    <SelectGroup key={group.id}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {formatThemesByGroup(group.id).map((theme) => (
                        <SelectItem key={theme.id} value={theme.id}>
                          {theme.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                写入本篇 article.yaml。分栏/预览按此样式显示，排版时小助理也用同一套。
              </p>
            </div>

            {/* Cover */}
            <div ref={coverPanelRef}>
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
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                保存时写入 article.yaml 的 digest。
              </p>
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
            </>
            )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      ) : null}

      {generateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-96 rounded-xl bg-white p-5 shadow-xl">
            <p className="mb-1 text-sm font-semibold text-slate-800">按参考 Prompt 生成配图</p>
            <p className="mb-3 text-xs text-slate-500">用设置里选中的图片模型生成。可用配图师写好的提示词，也可自己改一版。</p>
            <label className="mb-1 block text-xs font-medium text-slate-600">文件名</label>
            <input
              type="text"
              value={generateName}
              onChange={(event) => setGenerateName(event.target.value)}
              className="mb-3 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <label className="mb-1 block text-xs font-medium text-slate-600">参考 Prompt</label>
            <textarea
              value={generatePrompt}
              onChange={(event) => setGeneratePrompt(event.target.value)}
              rows={6}
              className="mb-4 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-indigo-400"
              placeholder="描述画面、风格、构图。无文字。"
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-60"
                disabled={!generatePrompt.trim() || generatingId != null}
                onClick={() => void handleGenerateGalleryImage()}
              >
                生成
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                onClick={() => setGenerateOpen(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
