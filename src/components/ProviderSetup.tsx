/**
 * ProviderSetup — direct provider registration UI.
 *
 * No cURL. User picks a provider from the registry, enters an API key,
 * optionally overrides the base URL, then selects a model.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Button,
  Label,
} from "@/components/ui";
import { useProvider } from "@/hooks/useProvider";
import type { ProviderDef } from "@/lib/providers/registry";
import { getProxyUrl, setProxyUrl, saveProviderConfig } from "@/lib/providers/storage";
import { invoke } from "@tauri-apps/api/core";

function ProviderTypeBadge({ type }: { type: ProviderDef["type"] }) {
  const map: Record<ProviderDef["type"], string> = {
    api: "bg-blue-100 text-blue-700",
    local: "bg-green-100 text-green-700",
    web: "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${map[type]}`}
    >
      {type}
    </span>
  );
}

interface ProviderSetupProps {
  onClose?: () => void;
}

export function ProviderSetup({ onClose }: ProviderSetupProps) {
  const {
    providers,
    active,
    selectProvider,
    getCredential,
    resolveError,
  } = useProvider();

  const [selectedId, setSelectedId] = useState(active?.providerId ?? "");
  const [apiKey, setApiKey] = useState(() =>
    active ? (getCredential(active.providerId)?.apiKey ?? "") : ""
  );
  const [baseUrlOverride, setBaseUrlOverride] = useState(() =>
    active ? (getCredential(active.providerId)?.baseUrlOverride ?? "") : ""
  );
  const [model, setModel] = useState(active?.model ?? "");
  const [modelInput, setModelInput] = useState(active?.model ?? "");
  const [imageModel, setImageModel] = useState(() => {
    if (!active) return "";
    const stored = getCredential(active.providerId);
    if (stored?.imageModel) return stored.imageModel;
    return providers.find((p) => p.id === active.providerId)?.suggestedImageModels?.[0] ?? "";
  });
  const [videoModel, setVideoModel] = useState(() => {
    if (!active) return "";
    const stored = getCredential(active.providerId);
    if (stored?.videoModel) return stored.videoModel;
    return providers.find((p) => p.id === active.providerId)?.suggestedVideoModels?.[0] ?? "";
  });
  const [saved, setSaved] = useState(false);
  const [proxyUrl, setProxyUrlState] = useState(() => getProxyUrl());
  const { t } = useTranslation("pages");

  const selectedDef = providers.find((p) => p.id === selectedId);

  const handleProviderChange = (id: string) => {
    setSelectedId(id);
    setSaved(false);
    const stored = getCredential(id);
    setApiKey(stored?.apiKey ?? "");
    setBaseUrlOverride(stored?.baseUrlOverride ?? "");
    const def = providers.find((p) => p.id === id);
    const m = stored?.model || def?.suggestedModels[0] || "";
    setModel(m);
    setModelInput(m);
    setImageModel(stored?.imageModel || def?.suggestedImageModels?.[0] || "");
    setVideoModel(stored?.videoModel || def?.suggestedVideoModels?.[0] || "");
  };

  const handleSave = () => {
    if (!selectedId) return;
    saveProviderConfig({
      providerId: selectedId,
      apiKey,
      model: modelInput.trim() || model,
      imageModel: imageModel || undefined,
      videoModel: videoModel || undefined,
      baseUrlOverride: baseUrlOverride || undefined,
    });
    selectProvider(selectedId, modelInput.trim() || model);
    // Save and apply proxy
    setProxyUrl(proxyUrl);
    void invoke("set_proxy_url", { proxyUrl }).catch(console.warn);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4 p-4 w-full max-w-md">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-[#18181b]">{t("providerSetup.title")}</h2>
        <p className="text-xs text-gray-500">{t("providerSetup.subtitle")}</p>
      </div>

      {/* Provider selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">Provider</Label>
        <Select value={selectedId} onValueChange={handleProviderChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={t("providerSetup.selectProvider")} />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                <span className="flex items-center gap-2">
                  {p.name}
                  <ProviderTypeBadge type={p.type} />
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedDef && (
        <>
          {/* API Key (hidden for local providers) */}
          {selectedDef.requiresKey && (
            <div className="space-y-1.5">
              <Label className="text-xs">API Key</Label>
              <Input
                type="password"
                className="h-8 text-xs font-mono"
                placeholder={`sk-...`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}

          {/* Base URL override */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Base URL
              <span className="ml-1 text-gray-400 font-normal">
                ({t("providerSetup.defaultLabel", { url: selectedDef.baseUrl })})
              </span>
            </Label>
            <Input
              type="url"
              className="h-8 text-xs font-mono"
              placeholder={selectedDef.baseUrl}
              value={baseUrlOverride}
              onChange={(e) => setBaseUrlOverride(e.target.value)}
            />
          </div>

          {/* HTTP Proxy */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              HTTP Proxy
              <span className="ml-1 text-gray-400 font-normal">(optional, e.g. http://10.144.1.10:8080)</span>
            </Label>
            <Input
              type="url"
              className="h-8 text-xs font-mono"
              placeholder="http://proxy-host:port"
              value={proxyUrl}
              onChange={(e) => setProxyUrlState(e.target.value)}
            />
          </div>

          {/* Text model */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("aiConfigs.textModel")}</Label>
            {selectedDef.suggestedModels.length > 0 ? (
              <div className="space-y-1.5">
                <Select
                  value={model}
                  onValueChange={(v) => {
                    setModel(v);
                    setModelInput(v);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={t("providerSetup.selectModel")} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedDef.suggestedModels.map((m) => (
                      <SelectItem key={m} value={m} className="text-xs font-mono">
                        {m}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__" className="text-xs text-gray-500">
                      {t("providerSetup.customModel")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {model === "__custom__" && (
                  <Input
                    className="h-8 text-xs font-mono"
                    placeholder={t("providerSetup.modelPlaceholder")}
                    value={modelInput === "__custom__" ? "" : modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
            ) : (
              <Input
                className="h-8 text-xs font-mono"
                placeholder={t("providerSetup.modelPlaceholder")}
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("aiConfigs.imageModel")}</Label>
            {(selectedDef.suggestedImageModels?.length ?? 0) > 0 ? (
              <Select value={imageModel} onValueChange={setImageModel}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t("providerSetup.selectModel")} />
                </SelectTrigger>
                <SelectContent>
                  {selectedDef.suggestedImageModels?.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs font-mono">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="h-8 text-xs font-mono"
                placeholder="image-model-id"
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("aiConfigs.videoModel")}</Label>
            {(selectedDef.suggestedVideoModels?.length ?? 0) > 0 ? (
              <Select value={videoModel} onValueChange={setVideoModel}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t("providerSetup.selectModel")} />
                </SelectTrigger>
                <SelectContent>
                  {selectedDef.suggestedVideoModels?.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs font-mono">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="h-8 text-xs font-mono"
                placeholder="video-model-id"
                value={videoModel}
                onChange={(e) => setVideoModel(e.target.value)}
              />
            )}
          </div>

          {resolveError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-md px-2 py-1.5">
              {resolveError}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={handleSave}
            >
              {saved ? t("providerSetup.saved") : t("providerSetup.saveAndActivate")}
            </Button>
            {onClose && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={onClose}
              >
                {t("providerSetup.close")}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
