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
  getActiveProvider,
  setActiveProvider,
  getProxyUrl,
  setProxyUrl,
} from "@/lib/providers/storage";
import { invoke } from "@tauri-apps/api/core";
import { ensureAgentFetch } from "@/lib/agent/agent-fetch";
import {
  ZERO_TOKEN_PLATFORMS,
  openZeroTokenLogin,
  checkZeroTokenSession,
  type ZeroTokenPlatform,
} from "@/lib/providers/adapters/zeroTokenService";
import { CheckCircle2, XCircle, RefreshCw, Loader2 } from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────

function defaultModel(def: ProviderDef): string {
  return def.suggestedModels[0] ?? "";
}

// ── main component ────────────────────────────────────────────────────────────

export const AIProviders = () => {
  const providers = getAllProviders().filter((p) => p.type !== "web");

  const initId = () => getActiveProvider()?.providerId ?? providers[0]?.id ?? "";

  const [selectedId, setSelectedId] = useState<string>(initId);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [modelList, setModelList] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Web / zero-token state ──────────────────────────────────────────────────
  const [ztPlatform, setZtPlatform] = useState<ZeroTokenPlatform>("doubao");
  const [isZtChecking, setIsZtChecking] = useState(false);
  const [ztResult, setZtResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [activeProvider, setActiveProviderState] = useState(() => getActiveProvider());
  const [proxyUrl, setProxyUrlState] = useState(() => getProxyUrl());
  const { t } = useTranslation("pages");

  // Apply saved proxy on mount so test connection also goes through it
  useEffect(() => {
    const saved = getProxyUrl();
    if (saved) void invoke("set_proxy_url", { proxyUrl: saved }).catch(console.warn);
  }, []);

  // Load stored config for the selected provider
  const loadConfig = useCallback((id: string) => {
    const def = getProvider(id);
    if (!def) return;
    const stored = getProviderConfig(id);
    setApiKey(stored?.apiKey ?? "");
    setBaseUrl(stored?.baseUrlOverride ?? "");
    setModel(stored?.model || defaultModel(def));
    setModelList(def.suggestedModels);
    setResult(null);
  }, []);

  useEffect(() => {
    loadConfig(selectedId);
  }, [selectedId, loadConfig]);

  const currentDef = getProvider(selectedId);

  // ── refresh models ──────────────────────────────────────────────────────────
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

  // ── save ────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    saveProviderConfig({
      providerId: selectedId,
      apiKey,
      model,
      baseUrlOverride: baseUrl || undefined,
    });
    setActiveProvider({ providerId: selectedId, model });
    setActiveProviderState({ providerId: selectedId, model });
    // Save and apply proxy
    setProxyUrl(proxyUrl);
    void invoke("set_proxy_url", { proxyUrl }).catch(console.warn);
    setResult({ ok: true, msg: t("aiConfigs.saved") });
    setTimeout(() => setResult(null), 2000);
  };

  // ── zero-token handlers ────────────────────────────────────────────────────
  const handleZtOpen = async () => {
    setZtResult(null);
    await openZeroTokenLogin(ztPlatform).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      setZtResult({ ok: false, msg });
    });
  };

  const handleZtCheck = async () => {
    setIsZtChecking(true);
    setZtResult(null);
    try {
      const res = await checkZeroTokenSession(ztPlatform);
      if (res.ok) {
        // Activate the matching web provider
        const providerId = `zt-${ztPlatform}`;
        const def = getProvider(providerId);
        const mdl = def?.suggestedModels[0] ?? ztPlatform;
        setActiveProvider({ providerId, model: mdl });
        setActiveProviderState({ providerId, model: mdl });
      }
      setZtResult({ ok: res.ok, msg: res.message });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setZtResult({ ok: false, msg });
    } finally {
      setIsZtChecking(false);
    }
  };

  const handleZtUse = () => {
    const providerId = `zt-${ztPlatform}`;
    const def = getProvider(providerId);
    const mdl = def?.suggestedModels[0] ?? ztPlatform;
    setActiveProvider({ providerId, model: mdl });
    setActiveProviderState({ providerId, model: mdl });
      setZtResult({ ok: true, msg: t("aiConfigs.switchedTo", { name: def?.name ?? providerId }) });
    setTimeout(() => setZtResult(null), 2000);
  };

  // ── test connection ─────────────────────────────────────────────────────────
  const handleTest = async () => {
    if (!currentDef) return;
    setIsTesting(true);
    setResult(null);
    try {
      const effectiveBaseUrl = baseUrl.trim() || currentDef.baseUrl;
      // Register host so the fetch shim routes it through Tauri plugin-http (proxy-aware)
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
      const body =
        currentDef.api === "anthropic-messages"
          ? JSON.stringify({
              model,
              max_tokens: 16,
              messages: [{ role: "user", content: "Hi" }],
            })
          : JSON.stringify({
              model,
              max_tokens: 16,
              messages: [{ role: "user", content: "Hi" }],
              stream: false,
            });
      const endpoint =
        currentDef.api === "anthropic-messages"
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

  return (
    <div id="ai-providers" className="space-y-4">
      {/* ── Active provider banner ───────────────────────────────────────── */}
      {activeProvider && (() => {
        const activeDef = getProvider(activeProvider.providerId);
        return (
          <div className="flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
            <span className="text-green-400 font-medium">{t("aiConfigs.activeLabel")}</span>
            <span className="text-foreground">{activeDef?.name ?? activeProvider.providerId}</span>
            {activeProvider.model && (
              <span className="ml-1 text-muted-foreground">/ {activeProvider.model}</span>
            )}
          </div>
        );
      })()}

      {/* ── Web Provider (zero-token) ────────────────────────────────────── */}
      <fieldset className="border border-secondary/30 rounded-lg p-4 space-y-4 bg-card/50">
        <legend className="px-2 text-sm font-medium text-secondary">
          {t("aiConfigs.webProviderTitle")}
        </legend>

        <p className="text-xs text-muted-foreground">
          {t("aiConfigs.webProviderDesc")}
        </p>

        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">{t("aiConfigs.platform")}</label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={ztPlatform}
            onChange={(e) => {
              setZtPlatform(e.target.value as ZeroTokenPlatform);
              setZtResult(null);
            }}
          >
            {ZERO_TOKEN_PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleZtUse}
            className="px-4 py-1.5 rounded-md bg-secondary text-secondary-foreground text-sm hover:bg-secondary/90 transition-colors"
          >
            {t("aiConfigs.useThisPlatform")}
          </button>
          <button
            type="button"
            onClick={handleZtOpen}
            className="px-4 py-1.5 rounded-md border border-input text-sm hover:bg-accent transition-colors"
          >
            {t("aiConfigs.openBrowserLogin")}
          </button>
          <button
            type="button"
            onClick={handleZtCheck}
            disabled={isZtChecking}
            className="px-4 py-1.5 rounded-md border border-input text-sm hover:bg-accent transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isZtChecking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("aiConfigs.checkSession")}
          </button>
        </div>

        {ztResult && (
          <div
            className={`flex items-center gap-1.5 text-sm ${
              ztResult.ok ? "text-green-500" : "text-destructive"
            }`}
          >
            {ztResult.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0" />
            )}
            <span className="break-all">{ztResult.msg}</span>
          </div>
        )}
      </fieldset>

      {/* ── API Provider ─────────────────────────────────────────────────── */}
      <fieldset className="border border-primary/30 rounded-lg p-4 space-y-4 bg-card/50">
        <legend className="px-2 text-sm font-medium text-primary">API Provider</legend>

        {/* Provider select */}
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">{t("aiConfigs.provider")}</label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <optgroup label="API">
              {providers
                .filter((p) => p.type === "api")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Local">
              {providers
                .filter((p) => p.type === "local")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>

        {currentDef && (
          <>
            {/* API Key */}
            {currentDef.requiresKey && (
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">API Key</label>
                <input
                  type="password"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
            )}

            {/* Base URL override */}
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{t("aiConfigs.baseUrl")}</label>
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={currentDef.baseUrl}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground/60">
                {t("aiConfigs.baseUrlHint")}
              </p>
            </div>

            {/* HTTP Proxy */}
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">HTTP Proxy <span className="text-xs text-muted-foreground/60">(optional)</span></label>
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                placeholder="http://10.144.1.10:8080"
                value={proxyUrl}
                onChange={(e) => setProxyUrlState(e.target.value)}
              />
              <p className="text-xs text-muted-foreground/60">设置后所有 API 请求经过此代理转发，清空则直连</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">{t("aiConfigs.model")}</label>
                <button
                  type="button"
                  onClick={handleRefreshModels}
                  disabled={isFetchingModels}
                  className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                >
                  {isFetchingModels ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  {t("aiConfigs.refreshModels")}
                </button>
              </div>
              {modelList.length > 0 ? (
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {modelList.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
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
                onClick={handleTest}
                disabled={isTesting}
                className="px-4 py-1.5 rounded-md border border-input text-sm hover:bg-accent transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isTesting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("aiConfigs.testConnection")}
              </button>
            </div>

            {/* Result */}
            {result && (
              <div
                className={`flex items-center gap-1.5 text-sm ${
                  result.ok ? "text-green-500" : "text-destructive"
                }`}
              >
                {result.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                <span className="break-all">{result.msg}</span>
              </div>
            )}
          </>
        )}
      </fieldset>
    </div>
  );
};

