/**
 * QuickSearchPanel
 *
 * Doubao answer first. Under it, references from local files and the IMA library.
 * Dismissed by pressing Escape or clicking the ✕ button.
 */
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  X,
  FileText,
  Sparkles,
  FolderOpen,
  AlertCircle,
  AppWindow,
} from "lucide-react";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "@/lib/utils";
import type {
  QuickSearchStatus,
  LocalResult,
  ImaReference,
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

function LocalResultItem({ result, onOpen }: { result: LocalResult; onOpen: (path: string) => void }) {
  const Icon = result.kind === "app" ? AppWindow : result.isDir ? FolderOpen : FileText;
  const name = result.name || result.path.split(/[\\/]/).pop() || result.path;
  const dir = result.path
    .replace(/[\\/][^\\/]+$/, "")
    .replace(/\\/g, "/");

  return (
    <button
      type="button"
      onClick={() => onOpen(result.path)}
      className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 group"
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-slate-600" />
      <div className="min-w-0">
        <p className="truncate text-[12px] font-medium text-slate-700">{name}</p>
        <p className="truncate text-[10px] text-slate-400">{dir}</p>
        {result.excerpt && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{result.excerpt}</p>
        )}
      </div>
    </button>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface QuickSearchPanelProps {
  isOpen: boolean;
  query: string;
  localResults: LocalResult[];
  imaResults: ImaReference[];
  imaHint: string | null;
  aiSummary: string;
  status: QuickSearchStatus;
  error: string | null;
  onClose: () => void;
}

export function QuickSearchPanel({
  isOpen,
  query,
  localResults,
  imaResults,
  imaHint,
  aiSummary,
  status,
  error,
  onClose,
}: QuickSearchPanelProps) {
  const { t } = useTranslation("common");
  const panelRef = useRef<HTMLDivElement>(null);
  // Dismiss on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const searching = status === "searching";
  const summarizing = status === "summarizing";
  const showReferences = !searching && status !== "idle";

  const openLocal = (path: string) => {
    void openPath(path).catch((err) => console.error("Failed to open local result:", err));
    onClose();
  };

  const openIma = (url: string) => {
    if (!url) return;
    void openUrl(url).catch((err) => console.error("Failed to open IMA url:", err));
  };

  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute left-0 right-0 top-[calc(100%+6px)] z-50",
        "max-h-[calc(100vh-72px)] overflow-y-auto",
        "rounded-2xl border border-[#e9e9e9] bg-white/96 shadow-lg backdrop-blur-md"
      )}
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      {/* ── Panel header ── */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/96 px-4 py-2.5">
        <span className="text-[12px] font-semibold text-slate-600 truncate max-w-[80%]">
          {query}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title={t("quickSearch.close")}
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

      <div>
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
            {(searching || (summarizing && !aiSummary)) ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            )}
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t("quickSearch.doubaoResult")}
            </span>
          </div>
          <div className="px-4 pb-3">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800">
              {aiSummary
                || (searching ? t("quickSearch.searching") : summarizing ? t("quickSearch.writing") : t("quickSearch.emptyAnswer"))}
              {summarizing && (
                <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse rounded-sm bg-slate-400" />
              )}
            </p>
          </div>
        </div>

      {showReferences && (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {t("quickSearch.references")}
          </p>
          <SectionHeader
            icon={<FileText className="h-3.5 w-3.5 text-slate-400" />}
            label={t("quickSearch.localRef")}
            loading={false}
          />
          {localResults.length === 0 ? (
            <p className="mb-3 px-2 text-[11px] text-slate-400">{t("quickSearch.none")}</p>
          ) : (
            <div className="mb-3 space-y-0.5">
              {localResults.slice(0, 6).map((result) => (
                <LocalResultItem key={result.path} result={result} onOpen={openLocal} />
              ))}
            </div>
          )}
          <SectionHeader
            icon={<FolderOpen className="h-3.5 w-3.5 text-slate-400" />}
            label={t("quickSearch.imaRef")}
            loading={false}
          />
          {imaResults.length === 0 ? (
            <p className="mb-3 px-2 text-[11px] text-slate-400">{imaHint || t("quickSearch.none")}</p>
          ) : (
            <div className="mb-3 space-y-0.5">
              {imaResults.slice(0, 6).map((item) => (
                <button
                  key={`${item.title}-${item.url}`}
                  type="button"
                  onClick={() => openIma(item.url)}
                  className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
                >
                  <p className="line-clamp-1 text-[12px] font-medium text-slate-700">《{item.title}》</p>
                  {item.excerpt && (
                    <p className="line-clamp-2 text-[11px] text-slate-500">{item.excerpt}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
