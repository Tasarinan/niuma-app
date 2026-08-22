/**
 * ApiProvidersTab — API key-based provider configuration with .env.local support.
 */
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  getAllProviders,
  getProvider,
  fetchModels,
  type ProviderDef,
} from "@/lib/providers/registry";
import {
  getProviderConfig,
  saveProviderConfig,
  getActiveApiProvider,
  setActiveApiProvider,
  setActiveProvider,
  getProxyUrl,
  setProxyUrl,
} from "@/lib/providers/storage";
import { invoke } from "@tauri-apps/api/core";
import { ensureAgentFetch } from "@/lib/agent/agent-fetch";
import { CheckCircle2, XCircle, RefreshCw, Loader2, FileKey } from "lucide-react";

// ── .env.local helpers ────────────────────────────────────────────────────────

/** Provider ID → ordered list of env var names to probe. */
const PROVIDER_ENV_KEYS: Record<string, string[]> = {
  openai:      ["OPENAI_API_KEY"],
  anthropic:   ["ANTHROPIC_API_KEY"],
  deepseek:    ["DEEPSEEK_API_KEY"],
  groq:        ["GROQ_API_KEY"],
  openrouter:  ["OPENROUTER_API_KEY"],
  kimi:        ["MOONSHOT_API_KEY"],
  nvidia:      ["NVIDIA_API_KEY"],
  agnes:       ["AGNES_API_KEY"],
};

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key) result[key] = val;
  }
  return result;
}

async function readEnvLocal(): Promise<Record<string, string>> {
  const root = await invoke<string>("get_niuma_root_dir").catch(() => "");
  const sep = root.includes("/") ? "/" : "\\";
  const candidates = [
    `${root}${sep}.env.local`,
    `${root}${sep}..${sep}.env.local`,
  ];
  for (const path of candidates) {
    try {
      const raw = await invoke<string>("read_text_file", { path });
      return parseEnvFile(raw);
    } catch {
      // try next
    }
  }
  return {};
}

function envKeyForProvider(providerId: string): string | undefined {
  const keys = PROVIDER_ENV_KEYS[providerId];
  return keys?.[0];
}

// ── helpers ───────────────────────────────────────────────────────────────────

function defaultModel(def: ProviderDef): string {
  return def.suggestedModels[0] ?? "";
}

// ── component ─────────────────────────────────────────────────────────────────

export const ApiProvidersTab = () => {
  const providers = getAllProviders().filter((p) => p.type !== "web");
  const initId = () => getActiveApiProvider()?.providerId ?? providers[0]?.id ?? "";

  const [selectedId, setSelectedId] = useState<string>(initId);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [modelList, setModelList] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [proxyUrl, setProxyUrlState] = useState(() => getProxyUrl());
  const [envFromFile, setEnvFromFile] = useState(false);
  const { t } = useTranslation("pages");

  useEffect(() => {
    const saved = getProxyUrl();
    if (saved) void invoke("set_proxy_url", { proxyUrl: saved }).catch(console.warn);
  }, []);

  const loadConfig = useCallback(async (id: string) => {
    const def = getProvider(id);
    if (!def) return;
    const stored = getProviderConfig(id);
    let key = stored?.apiKey ?? "";
    let fromEnv = false;
    // Auto-fill from .env.local when no key is stored yet
    if (!key && def.requiresKey) {
      const envVars = await readEnvLocal().catch((): Record<string, string> => ({}));
      const envKeys = PROVIDER_ENV_KEYS[id] ?? [];
      for (const envKey of envKeys) {
        if (envVars[envKey]) { key = envVars[envKey]; fromEnv = true; break; }
      }
    }
    setApiKey(key);
    setEnvFromFile(fromEnv);
    setBaseUrl(stored?.baseUrlOverride ?? "");
    setModel(stored?.model || defaultModel(def));
    setModelList(def.suggestedModels);
    setResult(null);
  }, []);

  useEffect(() => { void loadConfig(selectedId); }, [selectedId, loadConfig]);

  const currentDef = getProvider(selectedId);

  const handleLoadFromEnv = async () => {
    if (!currentDef) return;
    const envVars = await readEnvLocal().catch((): Record<string, string> => ({}));
    const envKeys = PROVIDER_ENV_KEYS[selectedId] ?? [];
    for (const envKey of envKeys) {
      if (envVars[envKey]) {
        setApiKey(envVars[envKey]);
        setEnvFromFile(true);
        return;
      }
    }
    setResult({ ok: false, msg: `.env.local 中未找到 ${envKeys[0] ?? "API_KEY"}` });
    setTimeout(() => setResult(null), 3000);
  };

  const handleRefreshModels = async () => {
    if (!currentDef) return;
    setIsFetchingModels(true);
    const fetched = await fetchModels(selectedId, apiKey, baseUrl || undefined);
    if (fetched.length > 0) {
      setModelList(fetched);
      if (!fetched.includes(model)) setModel(fetched[0]);
    }
    setIsFetchingModels(false);
  };

  const handleSave = () => {
    saveProviderConfig({ providerId: selectedId, apiKey, model, baseUrlOverride: baseUrl || undefined });
    setActiveApiProvider({ providerId: selectedId, model });
    setActiveProvider({ providerId: selectedId, model }); // keep legacy key in sync for useGroupChat
    setProxyUrl(proxyUrl);
    void invoke("set_proxy_url", { proxyUrl }).catch(console.warn);
    setEnvFromFile(false);
    setResult({ ok: true, msg: t("aiConfigs.saved") });
    setTimeout(() => setResult(null), 2000);
  };

  const handleTest = async () => {
    if (!currentDef) return;
    setIsTesting(true);
    setResult(null);
    try {
      const effectiveBaseUrl = baseUrl.trim() || currentDef.baseUrl;
      try { await ensureAgentFetch(new URL(effectiveBaseUrl).host); } catch { /**/ }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey.trim()) {
        if (currentDef.api === "anthropic-messages") {
          headers["x-api-key"] = apiKey.trim();
          headers["anthropic-version"] = "2023-06-01";
          headers["anthropic-dangerous-direct-browser-access"] = "true";
        } else {
          headers["Authorization"] = `Bearer ${apiKey.trim()}`;
        }
      }
      const body = currentDef.api === "anthropic-messages"
        ? JSON.stringify({ model, max_tokens: 16, messages: [{ role: "user", content: "Hi" }] })
        : JSON.stringify({ model, max_tokens: 16, messages: [{ role: "user", content: "Hi" }], stream: false });
      const endpoint = currentDef.api === "anthropic-messages"
        ? `${effectiveBaseUrl}/messages`
        : `${effectiveBaseUrl}/chat/completions`;
      const res = await fetch(endpoint, { method: "POST", headers, body });
      if (res.ok) {
        setResult({ ok: true, msg: t("aiConfigs.connectionOk") });
      } else {
        const err = await res.text().catch(() => res.statusText);
        setResult({ ok: false, msg: t("aiConfigs.connectionFail", { detail: `${res.status} ${err.slice(0, 120)}` }) });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setResult({ ok: false, msg: t("aiConfigs.connectionFail", { detail: msg }) });
    } finally {
      setIsTesting(false);
    }
  };

  const activeProvider = getActiveApiProvider();
  const isCurrentActive = activeProvider?.providerId === selectedId;
  const envKeyName = envKeyForProvider(selectedId);

  return (
    <div className="space-y-5">
      {/* Provider selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("aiConfigs.provider")}
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {providers.filter((p) => p.type === "api").map((p) => {
            const isSel = selectedId === p.id;
            const isAct = activeProvider?.providerId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={[
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-all",
                  isSel
                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                    : "border-border bg-card text-foreground hover:border-muted-foreground/40 hover:bg-muted/50",
                ].join(" ")}
              >
                <span className="truncate flex-1">{p.name}</span>
                {isAct && (
                  <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                    使用中
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {providers.filter((p) => p.type === "local").length > 0 && (
          <>
            <p className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">本地</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {providers.filter((p) => p.type === "local").map((p) => {
                const isSel = selectedId === p.id;
                const isAct = activeProvider?.providerId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={[
                      "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-all",
                      isSel
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                        : "border-border bg-card text-foreground hover:border-muted-foreground/40 hover:bg-muted/50",
                    ].join(" ")}
                  >
                    <span className="truncate flex-1">{p.name}</span>
                    {isAct && (
                      <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                        使用中
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {currentDef && (
        <div className="rounded-xl border bg-card p-4 space-y-4">
          {/* Active badge */}
          {isCurrentActive && activeProvider && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5 shrink-0" />
              <span className="font-medium">当前使用中</span>
              <span className="text-emerald-600/70 dark:text-emerald-500/70">/ {activeProvider.model}</span>
            </div>
          )}

          {/* API Key */}
          {currentDef.requiresKey && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">API Key</label>
                {envKeyName && (
                  <button
                    type="button"
                    onClick={() => void handleLoadFromEnv()}
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <FileKey className="size-3" />
                    从 .env.local 读取 ({envKeyName})
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="password"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring pr-24"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setEnvFromFile(false); }}
                />
                {envFromFile && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                    .env.local
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Base URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("aiConfigs.baseUrl")}</label>
            <input
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              placeholder={currentDef.baseUrl}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground/60">{t("aiConfigs.baseUrlHint")}</p>
          </div>

          {/* HTTP Proxy */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              HTTP Proxy <span className="text-muted-foreground/50">(可选)</span>
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              placeholder="http://10.144.1.10:8080"
              value={proxyUrl}
              onChange={(e) => setProxyUrlState(e.target.value)}
            />
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">{t("aiConfigs.model")}</label>
              <button
                type="button"
                onClick={() => void handleRefreshModels()}
                disabled={isFetchingModels}
                className="flex items-center gap-1 text-[10px] text-primary hover:underline disabled:opacity-50"
              >
                {isFetchingModels ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                {t("aiConfigs.refreshModels")}
              </button>
            </div>
            {modelList.length > 0 ? (
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {modelList.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={defaultModel(currentDef) || "model-id"}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              {t("aiConfigs.save")}
            </button>
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={isTesting}
              className="px-4 py-1.5 rounded-md border border-input text-sm hover:bg-accent transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isTesting && <Loader2 className="size-3.5 animate-spin" />}
              {t("aiConfigs.testConnection")}
            </button>
          </div>

          {result && (
            <div className={`flex items-center gap-1.5 text-sm ${result.ok ? "text-green-500" : "text-destructive"}`}>
              {result.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <XCircle className="size-4 shrink-0" />}
              <span className="break-all">{result.msg}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
