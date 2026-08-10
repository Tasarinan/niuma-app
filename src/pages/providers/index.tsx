/**
 * Workstation › Providers
 *
 * Two tabs:
 *   - API 提供商  — API key-based providers (OpenAI, Anthropic, DeepSeek …)
 *                  Supports auto-fill from .env.local. Used by agents + toolbar.
 *   - 网页零Token — Browser-session providers (Doubao, DeepSeek Web, Qwen)
 *                  Toolbar-only; agents require a real API key.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Cpu, Key, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveProvider } from "@/lib/providers/storage";
import { getProvider } from "@/lib/providers/registry";
import { ApiProvidersTab } from "./ai-configs/ApiProvidersTab";
import { ZeroTokenTab } from "./ai-configs/ZeroTokenTab";

type ProviderTab = "api" | "web";

const TABS: { id: ProviderTab; icon: React.ElementType; label: string }[] = [
  { id: "api",  icon: Key,   label: "API 提供商" },
  { id: "web",  icon: Globe, label: "网页零Token" },
];

export default function ProvidersPage() {
  const [tab, setTab] = useState<ProviderTab>("api");

  // Read active provider for the header badge (re-reads on every render;
  // tab components manage their own mutations so this stays in sync).
  const active = getActiveProvider();
  const activeDef = active ? getProvider(active.providerId) : null;
  const isWebActive = activeDef?.type === "web";

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-muted/20">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-0 border-b bg-background px-4">
        {/* Title */}
        <div className="flex items-center gap-2 pr-4 py-3 border-r mr-2">
          <Cpu className="size-4 text-muted-foreground" />
          <span className="font-semibold text-sm">AI 提供商</span>
          {activeDef && (
            <span
              className={cn(
                "ml-1 rounded-full px-2 py-0.5 text-[9px] font-semibold text-white",
                isWebActive ? "bg-blue-500" : "bg-emerald-500"
              )}
            >
              {activeDef.name}
            </span>
          )}
        </div>

        {/* Tabs */}
        {TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3" />
            {label}
            {id === "web" && isWebActive && (
              <span className="ml-1 rounded-full bg-blue-500 w-1.5 h-1.5 inline-block" />
            )}
            {id === "api" && !isWebActive && activeDef && (
              <span className="ml-1 rounded-full bg-emerald-500 w-1.5 h-1.5 inline-block" />
            )}
          </button>
        ))}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-4 max-w-2xl mx-auto">
          {tab === "api" && <ApiProvidersTab />}
          {tab === "web" && <ZeroTokenTab />}
        </div>
      </div>
    </div>
  );
}
