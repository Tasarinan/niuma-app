import { useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { AlertTriangle, Check, ChevronRight, LoaderCircle, MapPin, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { readText, writeText } from "@/lib/artifact/fs";
import {
  applyReplacePatch,
  countSubstringOccurrences,
  findAnchorRangeInDoc,
  isReviewStale,
  parseReviewMeta,
  parseReviewSuggestions,
  reviewMetaPath,
  reviewSuggestionsPath,
  sha256Hex,
  upsertSuggestionState,
  type ReviewBundle,
  type ReviewSuggestionItem,
} from "@/lib/content/article-review";

type Props = {
  draftFolder: string | null;
  editor: Editor | null;
  liveMarkdown: string;
  embedded?: boolean;
  refreshToken?: number;
};

const SEVERITY_LABEL = {
  blocker: "必须修改",
  suggestion: "建议修改",
} as const;

function severityClass(severity: ReviewSuggestionItem["severity"]) {
  return severity === "blocker"
    ? "border-rose-200 bg-rose-50/80 text-rose-950"
    : "border-amber-200 bg-amber-50/80 text-amber-950";
}

export function ArticleReviewPanel({ draftFolder, editor, liveMarkdown, embedded, refreshToken }: Props) {
  const [loading, setLoading] = useState(false);
  const [bundle, setBundle] = useState<ReviewBundle>({ meta: null, suggestions: null });
  const [articleHash, setArticleHash] = useState("");

  const reload = useCallback(async () => {
    if (!draftFolder) {
      setBundle({ meta: null, suggestions: null });
      setArticleHash("");
      return;
    }
    setLoading(true);
    try {
      const metaPath = reviewMetaPath(draftFolder);
      const sugPath = reviewSuggestionsPath(draftFolder);
      const [metaRaw, sugRaw] = await Promise.all([
        readText(metaPath).catch(() => ""),
        readText(sugPath).catch(() => ""),
      ]);
      setBundle({
        meta: metaRaw.trim() ? parseReviewMeta(metaRaw) : null,
        suggestions: sugRaw.trim() ? parseReviewSuggestions(sugRaw) : null,
      });
    } finally {
      setLoading(false);
    }
  }, [draftFolder]);

  useEffect(() => {
    void reload();
  }, [reload, refreshToken]);

  useEffect(() => {
    void (async () => {
      const hash = liveMarkdown ? await sha256Hex(liveMarkdown) : "";
      setArticleHash(hash);
    })();
  }, [liveMarkdown]);

  const stale = isReviewStale(bundle.meta, bundle.suggestions, articleHash);

  const persistSuggestions = async (next: NonNullable<ReviewBundle["suggestions"]>) => {
    if (!draftFolder) return;
    await writeText(reviewSuggestionsPath(draftFolder), `${JSON.stringify(next, null, 2)}\n`);
    setBundle((current) => ({ ...current, suggestions: next }));
  };

  const jumpToAnchor = (anchor: string) => {
    if (!editor) {
      toast.message("编辑器未就绪");
      return;
    }
    const needle = anchor.trim();
    if (!needle) return;
    if (!liveMarkdown.includes(needle)) {
      toast.error("当前正文中找不到该锚点");
      return;
    }
    const range = findAnchorRangeInDoc(editor.state.doc, needle);
    if (!range) {
      toast.message("锚点在渲染视图中未定位，请用正文搜索");
      return;
    }
    editor.chain().focus().setTextSelection(range).scrollIntoView().run();
  };

  const applyItem = async (item: ReviewSuggestionItem) => {
    if (!editor || !bundle.suggestions) return;
    if (!item.patch || item.patch.type !== "replace") {
      toast.message("该项没有可自动应用的替换补丁");
      return;
    }
    const result = applyReplacePatch(liveMarkdown, item.patch, item.anchor);
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    editor
      .chain()
      .focus()
      .setContent(result.markdown, { contentType: "markdown", emitUpdate: true })
      .run();
    const next = upsertSuggestionState(bundle.suggestions, item.id, { applied: true });
    await persistSuggestions(next);
    const hash = await sha256Hex(result.markdown);
    setArticleHash(hash);
    toast.success("已应用修改，可用撤销恢复");
  };

  const dismissItem = async (item: ReviewSuggestionItem) => {
    if (!bundle.suggestions) return;
    const next = upsertSuggestionState(bundle.suggestions, item.id, { dismissed: true });
    await persistSuggestions(next);
  };

  if (!draftFolder) {
    return (
      <p className={cn("text-xs leading-relaxed text-slate-400", embedded ? "px-1" : "p-3")}>
        打开已定题草稿目录后，可在此查看结构化审稿意见。
      </p>
    );
  }

  if (loading && !bundle.meta && !bundle.suggestions) {
    return (
      <div className="flex items-center justify-center gap-2 p-6 text-xs text-slate-400">
        <LoaderCircle className="size-4 animate-spin" />
        加载审稿…
      </div>
    );
  }

  if (!bundle.meta && !bundle.suggestions) {
    return (
      <p className={cn("text-xs leading-relaxed text-slate-400", embedded ? "px-1" : "p-3")}>
        尚无审稿元数据。在对话中请主编审稿后，会生成 review.md、review.meta.yaml 与 review.suggestions.json。
      </p>
    );
  }

  const items = bundle.suggestions?.items.filter((item) => !item.dismissed) ?? [];
  const openBlockers = items.filter((item) => item.severity === "blocker" && !item.applied).length;

  return (
    <div className={cn("space-y-3", embedded ? "" : "p-3")}>
      {stale ? (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="leading-relaxed">
            正文已变更，当前审稿针对旧版本。请保存后请主编重审，或仅作参考。
          </p>
        </div>
      ) : null}

      {bundle.meta ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>第 {bundle.meta.round} 轮</span>
            <span>
              状态：
              {bundle.meta.status === "pass" ? (
                <span className="font-medium text-emerald-700">通过</span>
              ) : (
                <span className="font-medium text-rose-700">待修改</span>
              )}
            </span>
            {openBlockers > 0 ? <span>未处理 🔴 {openBlockers}</span> : null}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{bundle.meta.reviewed_at}</p>
        </div>
      ) : null}

      {bundle.suggestions?.title?.score != null ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          标题评分：<span className="font-semibold">{bundle.suggestions.title.score}</span>
          {bundle.suggestions.title.candidates?.length ? (
            <ul className="mt-1.5 list-inside list-disc text-[11px] text-slate-500">
              {bundle.suggestions.title.candidates.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <ul className="space-y-2">
        {items.length === 0 ? (
          <li className="text-xs text-slate-400">没有待处理的审稿项。</li>
        ) : (
          items.map((item) => {
            const anchorCount = countSubstringOccurrences(liveMarkdown, item.anchor.trim());
            const canApply =
              Boolean(item.patch?.type === "replace") &&
              !item.applied &&
              !stale &&
              anchorCount === 1;
            return (
              <li
                key={item.id}
                className={cn("rounded-xl border px-3 py-2.5 text-xs", severityClass(item.severity))}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {SEVERITY_LABEL[item.severity]} · {item.category}
                    </p>
                    <p className="mt-1 leading-relaxed opacity-90">{item.reason}</p>
                    {item.suggestion ? (
                      <p className="mt-1 leading-relaxed opacity-80">建议：{item.suggestion}</p>
                    ) : null}
                    {item.anchor ? (
                      <p className="mt-1.5 truncate font-mono text-[10px] opacity-70" title={item.anchor}>
                        锚点：{item.anchor}
                      </p>
                    ) : null}
                    {anchorCount > 1 ? (
                      <p className="mt-1 text-[10px] opacity-80">锚点在正文中出现 {anchorCount} 次，无法自动替换</p>
                    ) : null}
                    {item.applied ? (
                      <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-emerald-800">
                        <Check className="size-3" /> 已应用
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-1 text-[11px] font-medium shadow-sm hover:bg-white"
                    onClick={() => jumpToAnchor(item.anchor)}
                  >
                    <MapPin className="size-3" />
                    定位
                  </button>
                  {item.patch?.type === "replace" ? (
                    <button
                      type="button"
                      disabled={!canApply}
                      className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-1 text-[11px] font-medium shadow-sm hover:bg-white disabled:opacity-40"
                      onClick={() => void applyItem(item)}
                    >
                      <Wand2 className="size-3" />
                      应用补丁
                    </button>
                  ) : null}
                  {!item.applied ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-600 hover:bg-white/60"
                      onClick={() => void dismissItem(item)}
                    >
                      <ChevronRight className="size-3" />
                      标为已处理
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
