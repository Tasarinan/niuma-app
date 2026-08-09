/**
 * useQuickSearch
 *
 * Runs a parallel local-file search + web search for a user query, then
 * streams an AI-generated summary via the same Pi agent as the main chat.
 */
import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

// ── Result types ─────────────────────────────────────────────────────────────

export interface LocalResult {
  name: string;
  path: string;
  isDir: boolean;
}

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

export type QuickSearchStatus =
  | "idle"
  | "searching"   // both searches in flight
  | "summarizing" // AI streaming
  | "done"
  | "error";

export interface UseQuickSearchReturn {
  isOpen: boolean;
  query: string;
  localResults: LocalResult[];
  webResults: WebResult[];
  aiSummary: string;
  status: QuickSearchStatus;
  error: string | null;
  runSearch: (q: string) => Promise<void>;
  close: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

type StreamFn = (
  prompt: string,
  systemPrompt: string,
  onDelta: (text: string) => void,
  signal: AbortSignal
) => Promise<void>;

export function useQuickSearch(streamFn: StreamFn): UseQuickSearchReturn {
  const [isOpen, setIsOpen]           = useState(false);
  const [query, setQuery]             = useState("");
  const [localResults, setLocal]      = useState<LocalResult[]>([]);
  const [webResults, setWeb]          = useState<WebResult[]>([]);
  const [aiSummary, setAiSummary]     = useState("");
  const [status, setStatus]           = useState<QuickSearchStatus>("idle");
  const [error, setError]             = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsOpen(false);
    setQuery("");
    setLocal([]);
    setWeb([]);
    setAiSummary("");
    setStatus("idle");
    setError(null);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    // Cancel any previous run.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsOpen(true);
    setQuery(trimmed);
    setLocal([]);
    setWeb([]);
    setAiSummary("");
    setError(null);
    setStatus("searching");

    try {
      // ── Phase 1: parallel searches ────────────────────────────────────────
      const [localRes, webRes] = await Promise.allSettled([
        invoke<{ entries: LocalResult[] }>("search_local_files", {
          query: trimmed,
          maxResults: 8,
        }),
        invoke<{ results: WebResult[] }>("web_search", {
          req: { query: trimmed, maxResults: 6 },
        }),
      ]);

      if (controller.signal.aborted) return;

      const local: LocalResult[] =
        localRes.status === "fulfilled" ? (localRes.value?.entries ?? []) : [];
      const web: WebResult[] =
        webRes.status === "fulfilled" ? (webRes.value?.results ?? []) : [];

      setLocal(local);
      setWeb(web);
      setStatus("summarizing");

      // ── Phase 2: AI summary via the main chat's Pi agent ─────────────────
      const localBlock =
        local.length > 0
          ? `本地文件结果：\n${local
              .slice(0, 8)
              .map((f) => `• ${f.path}`)
              .join("\n")}`
          : "未找到本地文件。";

      const webBlock =
        web.length > 0
          ? `网络搜索结果：\n${web
              .slice(0, 6)
              .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
              .join("\n\n")}`
          : "未找到网络结果。";

      const promptText =
        `用户查询："${trimmed}"\n\n${localBlock}\n\n${webBlock}\n\n` +
        `请根据以上搜索结果，用简洁清晰的语言回答用户查询。优先列出最相关的信息。`;

      await streamFn(
        promptText,
        "你是一个搜索摘要助手。请根据本地文件和网络搜索结果，简明扼要地回答用户的问题。",
        (text) => { if (!controller.signal.aborted) setAiSummary(text); },
        controller.signal
      );

      if (!controller.signal.aborted) {
        setStatus("done");
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setError(err?.message ?? "搜索失败");
        setStatus("error");
      }
    }
  }, [streamFn]);

  return {
    isOpen,
    query,
    localResults,
    webResults,
    aiSummary,
    status,
    error,
    runSearch,
    close,
  };
}
