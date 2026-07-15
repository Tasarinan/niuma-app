/**
 * Workstation › Providers
 *
 * Configure LLM providers used by agents.
 * Two categories:
 *   • Web Browser  – Zero-token providers (Claude Web, DeepSeek Web, etc.)
 *     Require a running ZeroToken bridge window; no API key needed.
 *   • API Key       – Standard API providers (OpenAI, Anthropic, Ollama, etc.)
 *     Configured via cURL template with {{API_KEY}} / {{MODEL}} placeholders.
 *
 * Active provider for all agents is persisted in app context.
 * Custom providers can be added, edited, deleted.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Switch, Textarea } from "@/components/ui";
import { AIProviders } from "./ai-configs";
import { useApp } from "@/store";
import type { TYPE_PROVIDER } from "@/types";
import { CheckCircle2, ChevronDown, ChevronUp, Cpu, Edit2, Globe, Key, Loader2, Plus, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Built-in provider presets ────────────────────────────────────────────────
const PRESETS: { id: string; name: string; kind: "web" | "api"; description: string; template: string }[] = [
  {
    id: "openai",
    name: "OpenAI",
    kind: "api",
    description: "GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo. Requires an OpenAI API key.",
    template: `curl https://api.openai.com/v1/chat/completions \\
  -H "Authorization: Bearer {{API_KEY}}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"{{MODEL}}","messages":{{MESSAGES}},"stream":true}'`,
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    kind: "api",
    description: "Claude Opus, Sonnet, Haiku. Requires an Anthropic API key.",
    template: `curl https://api.anthropic.com/v1/messages \\
  -H "x-api-key: {{API_KEY}}" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"{{MODEL}}","max_tokens":4096,"messages":{{MESSAGES}},"stream":true}'`,
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    kind: "api",
    description: "Run models locally via Ollama. No API key required.",
    template: `curl http://localhost:11434/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{"model":"{{MODEL}}","messages":{{MESSAGES}},"stream":true}'`,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    kind: "api",
    description: "Access 100+ models via a single API. Requires an OpenRouter API key.",
    template: `curl https://openrouter.ai/api/v1/chat/completions \\
  -H "Authorization: Bearer {{API_KEY}}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"{{MODEL}}","messages":{{MESSAGES}},"stream":true}'`,
  },
  {
    id: "deepseek-api",
    name: "DeepSeek API",
    kind: "api",
    description: "DeepSeek Chat/Coder via official API. Requires a DeepSeek API key.",
    template: `curl https://api.deepseek.com/chat/completions \\
  -H "Authorization: Bearer {{API_KEY}}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"{{MODEL}}","messages":{{MESSAGES}},"stream":true}'`,
  },
  {
    id: "claude-web",
    name: "Claude Web",
    kind: "web",
    description: "Use your Claude.ai subscription without an API key. Requires the ZeroToken bridge.",
    template: "zero-token://claude",
  },
  {
    id: "deepseek-web",
    name: "DeepSeek Web",
    kind: "web",
    description: "Use DeepSeek Chat via browser session. Requires the ZeroToken bridge.",
    template: "zero-token://deepseek",
  },
  {
    id: "doubao-web",
    name: "豆包 Web",
    kind: "web",
    description: "字节跳动豆包，通过浏览器会话使用。需要 ZeroToken 桥接。",
    template: "zero-token://doubao",
  },
];

const TABS = [
  { id: "direct" as const, icon: Zap, labelKey: "providersPage.tabDirect" },
  { id: "api" as const, icon: Key, labelKey: "providersPage.tabApi" },
  { id: "web" as const, icon: Globe, labelKey: "providersPage.tabWeb" },
];

function ProviderCard({
  provider,
  isActive,
  onActivate,
  onEdit,
  onDelete,
  canDelete,
}: {
  provider: TYPE_PROVIDER;
  isActive: boolean;
  onActivate: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}) {
  const { t } = useTranslation("pages");
  const isWeb = provider.curl?.startsWith("zero-token://");
  return (
    <div className={cn("rounded-xl border p-4 transition-all", isActive ? "border-primary/50 bg-primary/5" : "bg-card hover:shadow-sm")}>
      <div className="flex items-start gap-3">
        <div className={cn("flex size-9 flex-shrink-0 items-center justify-center rounded-xl", isWeb ? "bg-blue-50 text-blue-600 dark:bg-blue-950/30" : "bg-amber-50 text-amber-600 dark:bg-amber-950/30")}>
          {isWeb ? <Globe className="size-4" /> : <Key className="size-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm">{provider.name ?? provider.id}</p>
            {isWeb && <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Web</Badge>}
            {isActive && <Badge className="text-[9px] h-4 px-1.5 bg-primary">{t("providersPage.activeLabel")}</Badge>}
          </div>
          {provider.id && <p className="text-[10px] text-muted-foreground mt-0.5">{provider.id}</p>}
        </div>
        <div className="flex items-center gap-1">
          {!isActive && (
            <button onClick={onActivate} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium bg-foreground text-background hover:opacity-90 transition-opacity">
              <CheckCircle2 className="size-3" /> {t("providersPage.activate")}
            </button>
          )}
          {onEdit && <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="size-3.5" /></button>}
          {canDelete && onDelete && <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>}
        </div>
      </div>
    </div>
  );
}

const EMPTY_CUSTOM = { id: "", name: "", curl: "", streaming: true };

export default function ProvidersPage() {
  const { allAiProviders, customAiProviders, selectedAIProvider, onSetSelectedAIProvider } = useApp();
  const [tab, setTab] = useState<"direct" | "api" | "web">("direct");
  const [modalOpen, setModalOpen] = useState(false);
  const [editProvider, setEditProvider] = useState<typeof EMPTY_CUSTOM | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedPreset, setExpandedPreset] = useState<string | null>(null);
  const [presetVars, setPresetVars] = useState<Record<string, string>>({});
  const { t } = useTranslation("pages");

  const builtinProviders = allAiProviders.filter((p) => !p.isCustom);
  const apiBuiltin = builtinProviders.filter((p) => !p.curl?.startsWith("zero-token://"));
  const apiCustom = customAiProviders.filter((p) => !p.curl?.startsWith("zero-token://"));
  const webCustom = customAiProviders.filter((p) => p.curl?.startsWith("zero-token://"));
  const activeProvider = allAiProviders.find((p) => p.id === selectedAIProvider.provider);

  const activate = (provider: TYPE_PROVIDER) => {
    onSetSelectedAIProvider({ provider: provider.id ?? "", variables: {} });
  };

  const openNew = () => { setEditProvider({ ...EMPTY_CUSTOM }); setModalOpen(true); };
  const openEdit = (p: TYPE_PROVIDER) => { setEditProvider({ id: p.id ?? "", name: p.name ?? "", curl: p.curl ?? "", streaming: p.streaming ?? true }); setModalOpen(true); };

  const saveCustom = async () => {
    if (!editProvider?.id || !editProvider.curl) return;
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      setModalOpen(false);
    } finally { setSaving(false); }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-muted/20">
      {/* Top bar */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b bg-background px-5 py-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Cpu className="size-4 text-muted-foreground flex-shrink-0" />
          <span className="font-semibold text-sm">{t("providersPage.title")}</span>
          {activeProvider && (
            <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500 ml-1 shrink-0">{activeProvider.name ?? activeProvider.id}</Badge>
          )}
        </div>
        <div className="flex items-center rounded-xl bg-muted p-1 gap-0.5">
          {TABS.map(({ id, icon: Icon, labelKey }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="size-3.5" />{t(labelKey)}
            </button>
          ))}
        </div>
        {tab === "api" && (
          <Button size="sm" className="h-7 text-xs gap-1" onClick={openNew}>
            <Plus className="size-3" /> {t("providersPage.custom")}
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          {tab === "direct" && <AIProviders />}
          {tab === "api" && (
            <>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">{t("providersPage.builtinProviders")}</p>
              {PRESETS.filter((p) => p.kind === "api").map((preset) => {
                const isActive = selectedAIProvider.provider === preset.id;
                const expanded = expandedPreset === preset.id;
                return (
                  <div key={preset.id} className={cn("rounded-xl border overflow-hidden transition-all", isActive ? "border-primary/50" : "border-border")}>
                    <div className={cn("flex items-start gap-3 p-4", isActive ? "bg-primary/5" : "bg-card")}>
                      <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/30">
                        <Key className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{preset.name}</p>
                          {isActive && <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500">\u4f7f\u7528\u4e2d</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {!isActive && (
                          <button onClick={() => { activate({ id: preset.id, name: preset.name, curl: preset.template, streaming: true }); }}
                            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium bg-foreground text-background hover:opacity-80 transition-opacity">
                            <CheckCircle2 className="size-3" />{t("providersPage.activate")}
                          </button>
                        )}
                        <button onClick={() => setExpandedPreset(expanded ? null : preset.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        </button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="border-t bg-muted/30 p-3">
                        <p className="text-[10px] font-mono text-muted-foreground mb-2">{t("providersPage.curlTemplate")}</p>
                        <pre className="text-[10px] font-mono bg-background rounded-lg p-3 overflow-x-auto border">{preset.template}</pre>
                        <div className="mt-3 space-y-2">
                          {["API_KEY", "MODEL"].map((v) => (
                            <div key={v} className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-muted-foreground w-20 flex-shrink-0">{`{{${v}}}`}</span>
                              <Input value={presetVars[`${preset.id}.${v}`] ?? ""} onChange={(e) => setPresetVars((prev) => ({ ...prev, [`${preset.id}.${v}`]: e.target.value }))} type={v === "API_KEY" ? "password" : "text"} className="h-7 text-xs flex-1" placeholder={v === "API_KEY" ? "sk-..." : "gpt-4o"} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {(apiBuiltin.filter((p) => !PRESETS.find((pr) => pr.id === p.id)).length > 0 || apiCustom.length > 0) && (
                <>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-2">{t("providersPage.customProviders")}</p>
                  {[...apiBuiltin.filter((p) => !PRESETS.find((pr) => pr.id === p.id)), ...apiCustom].map((p) => (
                    <ProviderCard key={p.id} provider={p} isActive={selectedAIProvider.provider === p.id} onActivate={() => activate(p)} onEdit={() => openEdit(p)} onDelete={() => {}} canDelete={p.isCustom} />
                  ))}
                </>
              )}
            </>
          )}
          {tab === "web" && (
            <>
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-900 p-4">
                <div className="flex items-start gap-3">
                  <Globe className="size-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">{t("providersPage.zeroTokenBridge")}</p>
                    <p className="text-xs text-blue-600/80 dark:text-blue-500/80 mt-1 leading-relaxed">
                      {t("providersPage.zeroTokenDesc")}
                    </p>
                  </div>
                </div>
              </div>
              {PRESETS.filter((p) => p.kind === "web").map((preset) => {
                const prov: TYPE_PROVIDER = { id: preset.id, name: preset.name, curl: preset.template };
                const isActive = selectedAIProvider.provider === preset.id;
                return (
                  <div key={preset.id} className={cn("rounded-xl border p-4 transition-all", isActive ? "border-primary/50 bg-primary/5" : "bg-background hover:shadow-sm")}>
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/30"><Globe className="size-4" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{preset.name}</p>
                          <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Web</Badge>
                          {isActive && <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500">\u4f7f\u7528\u4e2d</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                      </div>
                      {!isActive && (
                        <button onClick={() => activate(prov)} className="flex-shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium bg-foreground text-background hover:opacity-80 transition-opacity">
                          <CheckCircle2 className="size-3" />\u6fc0\u6d3b
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {webCustom.map((p) => (
                <ProviderCard key={p.id} provider={p} isActive={selectedAIProvider.provider === p.id} onActivate={() => activate(p)} onEdit={() => openEdit(p)} canDelete={p.isCustom} onDelete={() => {}} />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Custom provider modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{t("providersPage.customDialog")}</DialogTitle></DialogHeader>
          {editProvider && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Provider ID *</Label><Input value={editProvider.id} onChange={(e) => setEditProvider((d) => d ? { ...d, id: e.target.value } : d)} className="h-8 text-xs" placeholder="my-provider" /></div>
                <div className="space-y-1.5"><Label className="text-xs">{t("providersPage.displayName")}</Label><Input value={editProvider.name} onChange={(e) => setEditProvider((d) => d ? { ...d, name: e.target.value } : d)} className="h-8 text-xs" /></div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("providersPage.curlTemplate")}</Label>
                <Textarea value={editProvider.curl} onChange={(e) => setEditProvider((d) => d ? { ...d, curl: e.target.value } : d)} rows={8} className="text-xs font-mono resize-none" placeholder={`curl https://api.example.com/v1/chat \\
  -H "Authorization: Bearer {{API_KEY}}" \\
  -d '{"model":"{{MODEL}}","messages":{{MESSAGES}}}'`} />
                <p className="text-[10px] text-muted-foreground">{t("providersPage.placeholders")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editProvider.streaming} onCheckedChange={(v) => setEditProvider((d) => d ? { ...d, streaming: v } : d)} />
                <Label className="text-xs">{t("providersPage.streaming")}</Label>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between pt-3 border-t mt-2">
            <button onClick={() => setModalOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">取消</button>
            <Button size="sm" className="h-8 text-xs" onClick={() => void saveCustom()} disabled={saving || !editProvider?.id || !editProvider?.curl}>
              {saving && <Loader2 className="size-3 animate-spin mr-1" />}保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
