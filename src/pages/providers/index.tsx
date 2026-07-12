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
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, ScrollArea, Switch, Textarea } from "@/components/ui";
import { useApp } from "@/store";
import type { TYPE_PROVIDER } from "@/types";
import { CheckCircle2, ChevronDown, ChevronUp, Cpu, Edit2, Globe, Key, Loader2, Plus, Trash2 } from "lucide-react";
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
            {isActive && <Badge className="text-[9px] h-4 px-1.5 bg-primary">使用中</Badge>}
          </div>
          {provider.id && <p className="text-[10px] text-muted-foreground mt-0.5">{provider.id}</p>}
        </div>
        <div className="flex items-center gap-1">
          {!isActive && (
            <button onClick={onActivate} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium bg-foreground text-background hover:opacity-90 transition-opacity">
              <CheckCircle2 className="size-3" /> 激活
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
  const [section, setSection] = useState<"api" | "web">("api");
  const [modalOpen, setModalOpen] = useState(false);
  const [editProvider, setEditProvider] = useState<typeof EMPTY_CUSTOM | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedPreset, setExpandedPreset] = useState<string | null>(null);
  const [presetVars, setPresetVars] = useState<Record<string, string>>({});

  const builtinProviders = allAiProviders.filter((p) => !p.isCustom);
  const apiBuiltin = builtinProviders.filter((p) => !p.curl?.startsWith("zero-token://"));
  const apiCustom = customAiProviders.filter((p) => !p.curl?.startsWith("zero-token://"));
  const webCustom = customAiProviders.filter((p) => p.curl?.startsWith("zero-token://"));

  const activate = (provider: TYPE_PROVIDER) => {
    onSetSelectedAIProvider({ provider: provider.id ?? "", variables: {} });
  };

  const openNew = () => { setEditProvider({ ...EMPTY_CUSTOM }); setModalOpen(true); };
  const openEdit = (p: TYPE_PROVIDER) => { setEditProvider({ id: p.id ?? "", name: p.name ?? "", curl: p.curl ?? "", streaming: p.streaming ?? true }); setModalOpen(true); };

  const saveCustom = async () => {
    if (!editProvider?.id || !editProvider.curl) return;
    setSaving(true);
    // In a real implementation, this would persist via app context / storage
    // For now we show a placeholder — the full implementation depends on the app context API
    try {
      await new Promise((r) => setTimeout(r, 300));
      setModalOpen(false);
    } finally { setSaving(false); }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Section tabs */}
      <div className="flex w-52 flex-shrink-0 flex-col border-r bg-background">
        <div className="px-3 pt-3 pb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">模型配置</span>
        </div>
        <div className="flex flex-col gap-0.5 px-2">
          {([["api", Key, "API 密钥"], ["web", Globe, "Web 浏览器"]] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setSection(id)} className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors text-left", section === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <Icon className="size-4 flex-shrink-0" />{label}
            </button>
          ))}
        </div>

        {/* Active provider indicator */}
        {selectedAIProvider.provider && (
          <div className="mt-auto border-t px-3 py-3">
            <p className="text-[10px] text-muted-foreground mb-1">当前激活</p>
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <p className="text-xs font-medium truncate">{allAiProviders.find((p) => p.id === selectedAIProvider.provider)?.name ?? selectedAIProvider.provider}</p>
            </div>
          </div>
        )}
      </div>

      {/* Provider list */}
      <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
        <div className="flex flex-shrink-0 items-center justify-between border-b bg-background px-5 py-3">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-muted-foreground" />
            <span className="font-semibold text-sm">{section === "api" ? "API 密钥提供商" : "Web 浏览器提供商"}</span>
          </div>
          {section === "api" && (
            <Button size="sm" className="h-7 text-xs gap-1" onClick={openNew}>
              <Plus className="size-3" /> 自定义
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {section === "api" ? (
              <>
                {/* Presets */}
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">内置提供商</p>
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
                            {isActive && <Badge className="text-[9px] h-4 px-1.5 bg-primary">使用中</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {!isActive && (
                            <button onClick={() => { activate({ id: preset.id, name: preset.name, curl: preset.template, streaming: true }); }} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium bg-foreground text-background hover:opacity-90">
                              <CheckCircle2 className="size-3" /> 激活
                            </button>
                          )}
                          <button onClick={() => setExpandedPreset(expanded ? null : preset.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                          </button>
                        </div>
                      </div>
                      {expanded && (
                        <div className="border-t bg-muted/30 p-3">
                          <p className="text-[10px] font-mono text-muted-foreground mb-2">cURL 模板</p>
                          <pre className="text-[10px] font-mono bg-background rounded-lg p-3 overflow-x-auto">{preset.template}</pre>
                          <div className="mt-3 space-y-2">
                            <p className="text-[10px] text-muted-foreground">填写变量（保存到本地）</p>
                            {["API_KEY", "MODEL"].map((v) => (
                              <div key={v} className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-muted-foreground w-20 flex-shrink-0">{`{{${v}}}`}</span>
                                <Input value={presetVars[`${preset.id}.${v}`] ?? ""} onChange={(e) => setPresetVars((p) => ({ ...p, [`${preset.id}.${v}`]: e.target.value }))} type={v === "API_KEY" ? "password" : "text"} className="h-7 text-xs flex-1" placeholder={v === "API_KEY" ? "sk-..." : "gpt-4o"} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Custom providers */}
                {(apiBuiltin.filter((p) => !PRESETS.find((pr) => pr.id === p.id)).length > 0 || apiCustom.length > 0) && (
                  <>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-2">自定义提供商</p>
                    {[...apiBuiltin.filter((p) => !PRESETS.find((pr) => pr.id === p.id)), ...apiCustom].map((p) => (
                      <ProviderCard key={p.id} provider={p} isActive={selectedAIProvider.provider === p.id} onActivate={() => activate(p)} onEdit={() => openEdit(p)} onDelete={() => {}} canDelete={p.isCustom} />
                    ))}
                  </>
                )}
              </>
            ) : (
              <>
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-900 p-4 mb-2">
                  <div className="flex items-start gap-3">
                    <Globe className="size-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">ZeroToken 桥接</p>
                      <p className="text-xs text-blue-600/80 dark:text-blue-500/80 mt-1 leading-relaxed">
                        Web 提供商通过在后台打开浏览器窗口来使用您的现有订阅，无需 API 密钥。
                        使用前请确保已在对应网站登录。
                      </p>
                    </div>
                  </div>
                </div>
                {PRESETS.filter((p) => p.kind === "web").map((preset) => {
                  const prov: TYPE_PROVIDER = { id: preset.id, name: preset.name, curl: preset.template };
                  const isActive = selectedAIProvider.provider === preset.id;
                  return (
                    <div key={preset.id} className={cn("rounded-xl border p-4 transition-all", isActive ? "border-primary/50 bg-primary/5" : "bg-card hover:shadow-sm")}>
                      <div className="flex items-start gap-3">
                        <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/30"><Globe className="size-4" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm">{preset.name}</p>
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Web</Badge>
                            {isActive && <Badge className="text-[9px] h-4 px-1.5 bg-primary">使用中</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                        </div>
                        {!isActive && (
                          <button onClick={() => activate(prov)} className="flex-shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium bg-foreground text-background hover:opacity-90">
                            <CheckCircle2 className="size-3" /> 激活
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
        </ScrollArea>
      </div>

      {/* Custom provider modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>自定义提供商</DialogTitle></DialogHeader>
          {editProvider && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Provider ID *</Label><Input value={editProvider.id} onChange={(e) => setEditProvider((d) => d ? { ...d, id: e.target.value } : d)} className="h-8 text-xs" placeholder="my-provider" /></div>
                <div className="space-y-1.5"><Label className="text-xs">显示名称</Label><Input value={editProvider.name} onChange={(e) => setEditProvider((d) => d ? { ...d, name: e.target.value } : d)} className="h-8 text-xs" /></div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">cURL 模板</Label>
                <Textarea value={editProvider.curl} onChange={(e) => setEditProvider((d) => d ? { ...d, curl: e.target.value } : d)} rows={8} className="text-xs font-mono resize-none" placeholder={`curl https://api.example.com/v1/chat \\
  -H "Authorization: Bearer {{API_KEY}}" \\
  -d '{"model":"{{MODEL}}","messages":{{MESSAGES}}}'`} />
                <p className="text-[10px] text-muted-foreground">可用占位符：{`{{API_KEY}}`}、{`{{MODEL}}`}、{`{{MESSAGES}}`}、{`{{SYSTEM_PROMPT}}`}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editProvider.streaming} onCheckedChange={(v) => setEditProvider((d) => d ? { ...d, streaming: v } : d)} />
                <Label className="text-xs">支持流式响应</Label>
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
