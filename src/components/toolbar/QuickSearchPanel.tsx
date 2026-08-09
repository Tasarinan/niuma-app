/**
 * QuickSearchPanel
 *
 * Inline expandable panel that appears directly below the main toolbar pill.
 * Shows parallel local + web search results and a streaming AI summary.
 * Dismissed by pressing Escape or clicking the ✕ button.
 */
import { useEffect, useRef } from "react";
import {
  Loader2,
  X,
  FileText,
  Globe,
  Sparkles,
  FolderOpen,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  QuickSearchStatus,
  LocalResult,
  WebResult,
} from "@/hooks/useQuickSearch";

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
      ) : (
        icon
      )}
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
    </div>
  );
}

function LocalResultItem({ result }: { result: LocalResult }) {
  const Icon = result.isDir ? FolderOpen : FileText;
  const name = result.name || result.path.split(/[\\/]/).pop() || result.path;
  const dir = result.path
    .replace(/[\\/][^\\/]+$/, "")
    .replace(/\\/g, "/");

  return (
    <div className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 group">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-slate-600" />
      <div className="min-w-0">
        <p className="truncate text-[12px] font-medium text-slate-700">{name}</p>
        <p className="truncate text-[10px] text-slate-400">{dir}</p>
      </div>
    </div>
  );
}

function WebResultItem({ result }: { result: WebResult }) {
  const hostname = (() => {
    try {
      return new URL(result.url).hostname.replace(/^www\./, "");
    } catch {
      return result.url;
    }
  })();

  return (
    <div className="rounded-lg px-2 py-1.5 hover:bg-slate-50 group">
      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[12px] font-medium text-blue-600 hover:underline line-clamp-1">
          {result.title}
        </p>
        <p className="text-[10px] text-slate-400">{hostname}</p>
        <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">
          {result.snippet}
        </p>
      </a>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface QuickSearchPanelProps {
  isOpen: boolean;
  query: string;
  localResults: LocalResult[];
  webResults: WebResult[];
  aiSummary: string;
  status: QuickSearchStatus;
  error: string | null;
  onClose: () => void;
}

export function QuickSearchPanel({
  isOpen,
  query,
  localResults,
  webResults,
  aiSummary,
  status,
  error,
  onClose,
}: QuickSearchPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const summaryEndRef = useRef<HTMLDivElement>(null);

  // Dismiss on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Auto-scroll AI summary
  useEffect(() => {
    summaryEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiSummary]);

  if (!isOpen) return null;

  const searching = status === "searching";
  const summarizing = status === "summarizing";
  const hasLocalResults = localResults.length > 0;
  const hasWebResults = webResults.length > 0;

  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute left-0 right-0 top-[calc(100%+6px)] z-50",
        "rounded-2xl border border-[#e9e9e9] bg-white/96 shadow-lg backdrop-blur-md",
        "overflow-hidden"
      )}
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      {/* ── Panel header ── */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <span className="text-[12px] font-semibold text-slate-600 truncate max-w-[80%]">
          {query}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title="关闭 (Esc)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="text-xs">{error}</span>
        </div>
      )}

      {/* ── Search results grid ── */}
      <div className="grid grid-cols-2 gap-0 divide-x divide-slate-100 max-h-48 overflow-hidden">
        {/* Local results */}
        <div className="overflow-y-auto p-3">
          <SectionHeader
            icon={<FileText className="h-3.5 w-3.5 text-slate-400" />}
            label="本地文件"
            loading={searching}
          />
          {!searching && !hasLocalResults && (
            <p className="text-[11px] text-slate-400 px-2">无匹配文件</p>
          )}
          <div className="space-y-0.5">
            {localResults.slice(0, 6).map((r, i) => (
              <LocalResultItem key={i} result={r} />
            ))}
          </div>
        </div>

        {/* Web results */}
        <div className="overflow-y-auto p-3">
          <SectionHeader
            icon={<Globe className="h-3.5 w-3.5 text-slate-400" />}
            label="在线搜索"
            loading={searching}
          />
          {!searching && !hasWebResults && (
            <p className="text-[11px] text-slate-400 px-2">无网络结果</p>
          )}
          <div className="space-y-1">
            {webResults.slice(0, 4).map((r, i) => (
              <WebResultItem key={i} result={r} />
            ))}
          </div>
        </div>
      </div>

      {/* ── AI Summary ── */}
      {(summarizing || aiSummary || status === "done") && (
        <div className="border-t border-slate-100">
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
            {summarizing && !aiSummary ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            )}
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              AI 摘要
            </span>
          </div>
          <div className="max-h-44 overflow-y-auto px-4 pb-3">
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700">
              {aiSummary}
              {summarizing && (
                <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse rounded-sm bg-slate-400" />
              )}
            </p>
            <div ref={summaryEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
