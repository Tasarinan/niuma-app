/**
 * Toolbar retrieval.
 *
 * Enter searches local file names and text contents, plus web results, then
 * sends that material as a prompt to the zero-token web model. The answer is
 * asked to cite local paths and URLs.
 */
import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { searchImaMaterials, type ImaTopicItem } from "@/lib/ima/openapi";

export interface LocalResult {
  name: string;
  path: string;
  isDir: boolean;
  kind: "app" | "file" | "dir";
  matchKind: "name" | "content";
  excerpt: string;
}

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

export type ImaReference = ImaTopicItem;

export type QuickSearchStatus =
  | "idle"
  | "searching"
  | "summarizing"
  | "done"
  | "error";

export interface UseQuickSearchReturn {
  isOpen: boolean;
  query: string;
  localResults: LocalResult[];
  webResults: WebResult[];
  imaResults: ImaReference[];
  imaHint: string | null;
  aiSummary: string;
  status: QuickSearchStatus;
  error: string | null;
  runSearch: (q: string) => Promise<void>;
  close: () => void;
}

type StreamFn = (
  prompt: string,
  systemPrompt: string,
  onDelta: (text: string) => void,
  signal: AbortSignal
) => Promise<void>;

function clip(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

const QUESTION_WORDS = [
  "有什么", "是什么", "怎么用", "如何用", "有哪些", "怎么样", "怎么办",
  "请问", "帮我", "一下", "什么", "怎么", "如何", "哪些", "技巧", "方法",
  "用法", "教程", "介绍", "分析", "总结", "区别", "比较",
  "的", "了", "吗", "呢", "吧", "和", "与", "及",
].sort((left, right) => right.length - left.length);

/** Pull lookup tokens out of a question. 「workbuddy有什么技巧」→ workbuddy. */
export function extractSearchTerms(question: string): string[] {
  const latin = question.match(/[A-Za-z][A-Za-z0-9_+.-]{1,}/g) ?? [];
  const hanChunks = question.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  const han: string[] = [];
  for (const chunk of hanChunks) {
    let rest = chunk;
    for (const word of QUESTION_WORDS) {
      rest = rest.split(word).join(" ");
    }
    for (const part of rest.split(/\s+/)) {
      const term = part.trim();
      if (term.length >= 2 && !QUESTION_WORDS.includes(term)) han.push(term);
    }
  }

  const terms: string[] = [];
  const seen = new Set<string>();
  for (const term of [...latin, ...han]) {
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length >= 3) break;
  }
  return terms.length > 0 ? terms : [question.trim()];
}

/** Lookup strings for one question. 「vibe coding」stays a phrase, plus its lead word. */
export function searchQueries(question: string): string[] {
  const trimmed = question.trim();
  const terms = extractSearchTerms(trimmed);
  if (terms.length <= 1) return terms.length > 0 ? terms : [trimmed];
  const phrase = terms.join(" ");
  const queries = [phrase];
  if (terms[0] && terms[0].toLowerCase() !== phrase.toLowerCase()) queries.push(terms[0]);
  return queries;
}

function mergeLocalResults(batches: LocalResult[][]): LocalResult[] {
  const merged = new Map<string, LocalResult>();
  for (const batch of batches) {
    for (const item of batch) {
      const key = item.path.toLowerCase();
      const previous = merged.get(key);
      if (!previous || (item.matchKind === "content" && previous.matchKind !== "content")) {
        merged.set(key, item);
      }
    }
  }
  return [...merged.values()].slice(0, 6);
}

export function buildRetrievalPrompt(
  query: string,
  localResults: LocalResult[],
  imaResults: ImaReference[],
): string {
  const localBlock = localResults.length
    ? localResults
        .map((item, index) => {
          const where = item.matchKind === "content" ? "正文" : "文件名";
          const excerpt = item.excerpt ? `\n摘录：${clip(item.excerpt, 280)}` : "";
          return `${index + 1}. [${where}] ${item.name}\n路径：${item.path}${excerpt}`;
        })
        .join("\n\n")
    : "（没有匹配的本地文件）";

  const imaBlock = imaResults.length
    ? imaResults
        .map((item, index) => {
          const excerpt = item.excerpt ? `\n摘录：${clip(item.excerpt, 280)}` : "";
          const url = item.url ? `\n网址：${item.url}` : "";
          return `${index + 1}. 《${item.title}》${excerpt}${url}`;
        })
        .join("\n\n")
    : "（IMA 资料库没有匹配条目）";

  const terms = extractSearchTerms(query);
  return [
    `用户问题：${query}`,
    `检索词：${terms.join("、")}`,
    "",
    "本地材料：",
    localBlock,
    "",
    "IMA 资料库：",
    imaBlock,
    "",
    "请用豆包结合以上材料回答问题。",
    "只写分析正文，不要自己追加参考列表。",
    "材料里没有的路径、文章和网址不要编造。",
  ].join("\n");
}

const SYSTEM_PROMPT = [
  "你是豆包，运行在网页零 Token 通道。",
  "先读本地文件摘录和 IMA 资料库条目，再回答用户问题。",
  "只输出分析正文。参考来源由界面列在答案下面，不要在正文里写「参考」或「定位」。",
  "没有对应材料时直接说明，不要编造本地路径或 IMA 文章。",
].join("\n");

export function useQuickSearch(streamFn: StreamFn): UseQuickSearchReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [localResults, setLocal] = useState<LocalResult[]>([]);
  const [webResults, setWeb] = useState<WebResult[]>([]);
  const [imaResults, setIma] = useState<ImaReference[]>([]);
  const [imaHint, setImaHint] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState("");
  const [status, setStatus] = useState<QuickSearchStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsOpen(false);
    setQuery("");
    setLocal([]);
    setWeb([]);
    setIma([]);
    setImaHint(null);
    setAiSummary("");
    setStatus("idle");
    setError(null);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.startsWith("/")) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    document.body.dataset.quickSearchOpen = "true";
    setIsOpen(true);
    setQuery(trimmed);
    setLocal([]);
    setWeb([]);
    setIma([]);
    setImaHint(null);
    setAiSummary("");
    setError(null);
    setStatus("searching");

    try {
      const queries = searchQueries(trimmed);
      const lookup = queries[0] ?? trimmed;
      const [localBatches, imaPack] = await Promise.all([
        Promise.allSettled(
          queries.map((term) =>
            invoke<{ entries: LocalResult[] }>("quick_search_local", {
              req: { query: term, maxResults: 4 },
            }),
          ),
        ),
        searchImaMaterials(lookup).catch((err: unknown) => ({
          status: "error" as const,
          query: lookup,
          items: [] as ImaReference[],
          errors: [err instanceof Error ? err.message : "IMA 搜索失败"],
        })),
      ]);
      if (controller.signal.aborted) return;

      const local = mergeLocalResults(
        localBatches.map((batch) => (batch.status === "fulfilled" ? (batch.value?.entries ?? []) : [])),
      );
      const ima = imaPack.items ?? [];
      setLocal(local);
      setIma(ima);
      setImaHint(ima.length > 0 ? null : (imaPack.errors?.[0] ?? null));
      setStatus("summarizing");

      await streamFn(
        buildRetrievalPrompt(trimmed, local, ima),
        SYSTEM_PROMPT,
        (text) => {
          if (!controller.signal.aborted) setAiSummary(text);
        },
        controller.signal,
      );
      if (!controller.signal.aborted) setStatus("done");
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "检索总结失败");
      setStatus("error");
    }
  }, [streamFn]);

  return {
    isOpen,
    query,
    localResults,
    webResults,
    imaResults,
    imaHint,
    aiSummary,
    status,
    error,
    runSearch,
    close,
  };
}
