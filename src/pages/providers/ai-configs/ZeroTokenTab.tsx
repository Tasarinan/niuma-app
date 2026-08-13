/**
 * ZeroTokenTab — web browser session (zero-token) provider configuration.
 * Note: web providers only work for the main Toolbar completion, NOT for agents.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getProvider } from "@/lib/providers/registry";
import { getActiveWebProvider, setActiveWebProvider, setActiveProvider } from "@/lib/providers/storage";
import {
  ZERO_TOKEN_PLATFORMS,
  openZeroTokenLogin,
  checkZeroTokenSession,
  type ZeroTokenPlatform,
} from "@/lib/providers/adapters/zeroTokenService";
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";

export const ZeroTokenTab = () => {
  const [ztPlatform, setZtPlatform] = useState<ZeroTokenPlatform>("doubao");
  const [isZtChecking, setIsZtChecking] = useState(false);
  const [ztResult, setZtResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [activeProvider, setActiveProviderState] = useState(() => getActiveWebProvider());
  const { t } = useTranslation("pages");

  const activate = (providerId: string) => {
    const def = getProvider(providerId);
    const mdl = def?.suggestedModels[0] ?? providerId;
    // Write to dedicated web storage (for independent display)
    setActiveWebProvider({ providerId, model: mdl });
    // Keep legacy single-key in sync so toolbar zero-token path still works
    setActiveProvider({ providerId, model: mdl });
    setActiveProviderState({ providerId, model: mdl });
  };

  const handleZtOpen = async () => {
    setZtResult(null);
    await openZeroTokenLogin(ztPlatform).catch((e: unknown) => {
      setZtResult({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    });
  };

  const handleZtCheck = async () => {
    setIsZtChecking(true);
    setZtResult(null);
    try {
      const res = await checkZeroTokenSession(ztPlatform);
      if (res.ok) activate(`zt-${ztPlatform}`);
      setZtResult({ ok: res.ok, msg: res.message });
    } catch (e: unknown) {
      setZtResult({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsZtChecking(false);
    }
  };

  const handleZtUse = () => {
    activate(`zt-${ztPlatform}`);
    const def = getProvider(`zt-${ztPlatform}`);
    setZtResult({ ok: true, msg: t("aiConfigs.switchedTo", { name: def?.name ?? ztPlatform }) });
    setTimeout(() => setZtResult(null), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Warning */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700/50 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold">网页零Token模式不支持智能体对话</p>
          <p className="opacity-80">工具调用、技能和流式输出需要正式 API 密钥。智能体频道请切换到「API 提供商」标签。</p>
          <p className="opacity-60">网页模式仅适用于主工具栏的单轮对话。</p>
        </div>
      </div>

      {/* Active indicator — shows the web provider saved in this tab independently */}
      {activeProvider && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 px-3 py-1.5 text-xs text-blue-700 dark:text-blue-400">
          <CheckCircle2 className="size-3.5 shrink-0" />
          <span className="font-medium">当前配置：</span>
          <span>{getProvider(activeProvider.providerId)?.name ?? activeProvider.providerId}</span>
        </div>
      )}

      {/* Platform cards */}
      <div className="grid grid-cols-1 gap-2">
        {ZERO_TOKEN_PLATFORMS.map((p) => {
          const providerId = `zt-${p.id}`;
          const isActive = activeProvider?.providerId === providerId;
          const isSelected = ztPlatform === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setZtPlatform(p.id)}
              className={[
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-card hover:border-muted-foreground/40 hover:bg-muted/30",
              ].join(" ")}
            >
              <span className="flex-1">{p.name}</span>
              {isActive && (
                <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[9px] font-semibold text-white">
                  已配置
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleZtUse}
          className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
        >
          {t("aiConfigs.useThisPlatform")}
        </button>
        <button
          type="button"
          onClick={() => void handleZtOpen()}
          className="px-4 py-1.5 rounded-md border border-input text-sm hover:bg-accent transition-colors"
        >
          {t("aiConfigs.openBrowserLogin")}
        </button>
        <button
          type="button"
          onClick={() => void handleZtCheck()}
          disabled={isZtChecking}
          className="px-4 py-1.5 rounded-md border border-input text-sm hover:bg-accent transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {isZtChecking && <Loader2 className="size-3.5 animate-spin" />}
          {t("aiConfigs.checkSession")}
        </button>
      </div>

      {ztResult && (
        <div className={`flex items-center gap-1.5 text-sm ${ztResult.ok ? "text-green-500" : "text-destructive"}`}>
          {ztResult.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <XCircle className="size-4 shrink-0" />}
          <span className="break-all">{ztResult.msg}</span>
        </div>
      )}
    </div>
  );
};
