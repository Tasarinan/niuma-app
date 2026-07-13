import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Selection, Focus } from "@tiptap/extensions";
import { FileHandler } from "@tiptap/extension-file-handler";
import { Markdown } from "@tiptap/markdown";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import {
  Bold,
  CheckSquare,
  Code2,
  Download,
  Eye,
  FileInput,
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
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Markdown as MarkdownPreview } from "@/components/Markdown";
import { MathExtension } from "@/components/article-editor/math";
import { SlashCommands } from "@/components/article-editor/slash-commands";
import { suggestionItems } from "@/components/article-editor/suggestion-items";
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
const lowlight = createLowlight(common);

function createArticle(partial?: Partial<ArticleRecord>): ArticleRecord {
  const now = new Date().toISOString();
  return {
    id: partial?.id ?? crypto.randomUUID(),
    title: partial?.title ?? "未命名文章",
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

const toolbarButtonClass = "h-9 rounded-full border border-slate-200 bg-white px-3 text-slate-600 hover:bg-slate-50 hover:text-slate-950";

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

  const activeArticle = useMemo(() => {
    return articles.find((article) => article.id === activeId) ?? articles[0] ?? null;
  }, [activeId, articles]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: "end",
    content: activeArticle?.content ?? "",
    contentType: "markdown",
    editorProps: {
      attributes: {
        class:
          "article-editor typography min-h-[55vh] max-w-none px-8 py-10 text-[15px] outline-none sm:px-12",
      },
    },
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Selection,
      Focus.configure({ className: "has-focus", mode: "all" }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "输入标题...";
          return "输入正文，或使用 / 打开命令菜单";
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({
        resizable: true,
        allowTableNodeSelection: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({ lowlight }),
      MathExtension,
      FileHandler.configure({
        allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"],
        onDrop: async (editorInstance, files, position) => {
          for (const file of files) {
            const url = await fileToDataUrl(file);
            editorInstance.chain().focus().insertContentAt(position, { type: "image", attrs: { src: url, alt: file.name } }).run();
          }
        },
        onPaste: async (editorInstance, files) => {
          for (const file of files) {
            const url = await fileToDataUrl(file);
            editorInstance.chain().focus().setImage({ src: url, alt: file.name }).run();
          }
        },
      }),
      Markdown.configure({
        indentation: {
          style: "space",
          size: 2,
        },
      }),
      SlashCommands.configure({
        commandItems: suggestionItems,
      }),
    ],
    onCreate({ editor: instance }) {
      setMarkdownSource(instance.getMarkdown());
    },
    onUpdate({ editor: instance }) {
      if (isSettingContentRef.current) return;
      const content = instance.getMarkdown();
      setMarkdownSource(content);
      setArticles((current) =>
        current.map((article) =>
          article.id === activeIdRef.current
            ? {
                ...article,
                content,
                updatedAt: new Date().toISOString(),
              }
            : article
        )
      );
    },
  });

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
    toast.success("文章已保存到本地");
  };

  const handleCreateArticle = () => {
    const next = createArticle();
    setArticles((current) => [next, ...current]);
    setActiveId(next.id);
    setMode("write");
    toast.success("已创建新文章");
  };

  const handleDeleteArticle = () => {
    if (!activeArticle) return;
    const nextArticles = articles.filter((article) => article.id !== activeArticle.id);
    if (!nextArticles.length) {
      const fallback = createArticle();
      setArticles([fallback]);
      setActiveId(fallback.id);
      toast.success("已删除文章，并创建空白草稿");
      return;
    }
    setArticles(nextArticles);
    setActiveId(nextArticles[0].id);
    toast.success("文章已删除");
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
      const title = file.name.replace(/\.md$/i, "") || "导入文章";
      const imported = createArticle({ title, content: text });
      setArticles((current) => [imported, ...current]);
      setActiveId(imported.id);
      setMode("write");
      toast.success("Markdown 已导入");
    } catch {
      toast.error("导入失败");
    }
  };

  const insertImageFromFile = async (file: File | null) => {
    if (!file || !editor) return;
    try {
      const url = await fileToDataUrl(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      toast.success("图片已插入");
    } catch {
      toast.error("图片读取失败");
    }
  };

  if (!activeArticle) {
    return null;
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-[1600px] flex-col gap-4">
        <Card className="rounded-[28px] border border-white/70 bg-white/85 p-4 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-[220px] max-w-sm flex-1">
                <div className="mb-1 text-xs font-medium uppercase tracking-[0.28em] text-slate-400">Article</div>
                <select
                  value={activeArticle.id}
                  onChange={(event) => setActiveId(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-indigo-400"
                >
                  {articles.map((article) => (
                    <option key={article.id} value={article.id}>
                      {article.title || "未命名文章"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleCreateArticle} className="rounded-full bg-slate-950 px-4 text-white hover:bg-slate-800">
                  <Plus className="mr-2 size-4" />
                  新建
                </Button>
                <Button type="button" variant="outline" className="rounded-full" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 size-4" />
                  导入 Markdown
                </Button>
                <Button type="button" variant="outline" className="rounded-full" onClick={handleDeleteArticle}>
                  <Trash2 className="mr-2 size-4" />
                  删除
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,text/markdown"
                  className="hidden"
                  onChange={(event) => {
                    void handleImportMarkdown(event.target.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-slate-200 bg-slate-50 p-1">
                {[
                  { key: "write", label: "编辑", icon: PencilLine },
                  { key: "split", label: "分栏", icon: Split },
                  { key: "preview", label: "预览", icon: Eye },
                ].map((item) => (
                  <Button
                    key={item.key}
                    type="button"
                    variant="ghost"
                    onClick={() => setMode(item.key as EditorMode)}
                    className={cn(
                      "rounded-full px-3 text-slate-500",
                      mode === item.key && "bg-white text-slate-950 shadow-sm"
                    )}
                  >
                    <item.icon className="mr-2 size-4" />
                    {item.label}
                  </Button>
                ))}
              </div>
              <Button type="button" variant="outline" className="rounded-full" onClick={handleExportMarkdown}>
                <Download className="mr-2 size-4" />
                导出
              </Button>
              <Button type="button" onClick={() => void handleSave()} className="rounded-full bg-indigo-600 px-4 text-white hover:bg-indigo-500">
                {isSaving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                保存
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="overflow-hidden rounded-[32px] border border-white/70 bg-white/88 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-8">
              <Input
                value={activeArticle.title}
                onChange={(event) => updateArticle({ title: event.target.value || "未命名文章" })}
                className="h-auto border-0 px-0 text-3xl font-semibold tracking-[-0.04em] text-slate-950 shadow-none placeholder:text-slate-300 focus-visible:ring-0"
                placeholder="文章标题"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleBold().run()}>
                  <Bold className="size-4" />
                </Button>
                <Button type="button" variant="outline" className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
                  <Heading1 className="size-4" />
                </Button>
                <Button type="button" variant="outline" className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
                  <Heading2 className="size-4" />
                </Button>
                <Button type="button" variant="outline" className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                  <List className="size-4" />
                </Button>
                <Button type="button" variant="outline" className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
                  <ListOrdered className="size-4" />
                </Button>
                <Button type="button" variant="outline" className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleTaskList().run()}>
                  <CheckSquare className="size-4" />
                </Button>
                <Button type="button" variant="outline" className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
                  <Quote className="size-4" />
                </Button>
                <Button type="button" variant="outline" className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
                  <Code2 className="size-4" />
                </Button>
                <Button type="button" variant="outline" className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleMathDisplay().run()}>
                  <Sigma className="size-4" />
                </Button>
                <Button type="button" variant="outline" className={toolbarButtonClass} onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                  <Table2 className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={toolbarButtonClass}
                  onClick={() => {
                    const href = window.prompt("输入链接地址", "https://");
                    if (!href) return;
                    editor?.chain().focus().extendMarkRange("link").setLink({ href }).run();
                  }}
                >
                  <Link2 className="size-4" />
                </Button>
                <label className={cn(toolbarButtonClass, "inline-flex cursor-pointer items-center gap-2")}> 
                  <ImagePlus className="size-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      void insertImageFromFile(event.target.files?.[0] ?? null);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="mt-3 text-xs text-slate-400">支持标题、任务列表、表格、代码块、数学公式、图片粘贴/拖拽、Markdown 导入导出，以及 / 命令菜单。</div>
            </div>

            <div className={cn("grid min-h-[68vh]", mode === "split" ? "lg:grid-cols-2" : "grid-cols-1")}>
              {/* Left pane: rich editor (write) or raw markdown textarea (split) */}
              {mode !== "preview" ? (
                <div className={cn("min-w-0", mode === "split" && "border-b border-slate-100 lg:border-b-0 lg:border-r")}>
                  <EditorContent editor={editor} />
                </div>
              ) : null}
              {/* Right pane: rendered markdown preview (split or preview mode) */}
              {mode !== "write" ? (
                <ScrollArea className={cn("min-w-0", mode === "split" ? "bg-slate-50/80" : "bg-white")}>
                  <div className="mx-auto max-w-4xl px-8 py-10 sm:px-12">
                    <MarkdownPreview>{markdownSource}</MarkdownPreview>
                  </div>
                </ScrollArea>
              ) : null}
            </div>
          </Card>

          <Card className="rounded-[32px] border border-white/70 bg-white/88 p-5 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">Meta</div>
            <div className="mt-4 space-y-5">
              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">封面图</div>
                {activeArticle.cover ? (
                  <img src={activeArticle.cover} alt={activeArticle.title} className="h-40 w-full rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                    暂无封面
                  </div>
                )}
                <label className="mt-3 inline-flex cursor-pointer items-center rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  <FileInput className="mr-2 size-4" />
                  上传封面
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0] ?? null;
                      if (!file) return;
                      const url = await fileToDataUrl(file);
                      updateArticle({ cover: url });
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">摘要</div>
                <textarea
                  value={activeArticle.summary}
                  onChange={(event) => updateArticle({ summary: event.target.value })}
                  placeholder="写一段摘要，作为文章概览。"
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-indigo-400"
                />
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">标签</div>
                <Input
                  value={activeArticle.tags.join(", ")}
                  onChange={(event) => {
                    const tags = event.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean);
                    updateArticle({ tags });
                  }}
                  placeholder="AI, Product, Draft"
                  className="rounded-2xl"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeArticle.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
                <div className="flex items-center justify-between">
                  <span>最后更新</span>
                  <span className="font-medium text-slate-700">{formatTime(activeArticle.updatedAt)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span>字数</span>
                  <span className="font-medium text-slate-700">{markdownSource.replace(/\s+/g, "").length}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span>模式</span>
                  <span className="font-medium text-slate-700">{mode === "write" ? "编辑" : mode === "split" ? "分栏" : "预览"}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
