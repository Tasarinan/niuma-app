import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { loadWechatReadyPack, type WechatSlot } from "@/lib/wechat/accounts";
import {
  resolveWorkspaceRoot,
  runWechatFormatForDraft,
  runWechatPublishFullForDraft,
} from "@/lib/content/wechat-draft-pipeline";

type Props = {
  draftDirAbs: string | null;
  onBeforeRun?: () => Promise<void>;
};

export function ArticleExportPanel({ draftDirAbs, onBeforeRun }: Props) {
  const [slots, setSlots] = useState<WechatSlot[]>([]);
  const [accountSlot, setAccountSlot] = useState<string>("");
  const [formatting, setFormatting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadWechatReadyPack().then((pack) => {
      if (cancelled) return;
      setSlots(pack.slots.filter((s) => s.hasAppId && s.hasSecret));
      const first = pack.selectedSlot ?? pack.slots.find((s) => s.hasAppId)?.slot;
      if (first) setAccountSlot(String(first));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const runFormat = useCallback(async () => {
    if (!draftDirAbs) {
      toast.message("请先打开一篇已落盘的稿件。");
      return;
    }
    setFormatting(true);
    try {
      await onBeforeRun?.();
      const root = await resolveWorkspaceRoot();
      if (!root) throw new Error("无法解析工作区根目录");
      const result = await runWechatFormatForDraft({ draftDirAbs, workspaceRoot: root });
      if (result.ok) {
        toast.success("已生成微信排版（article.html）");
      } else {
        const detail = (result.stderr || result.stdout).trim().slice(0, 400);
        toast.error(detail || `排版失败（exit ${result.exitCode ?? "?"})`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setFormatting(false);
    }
  }, [draftDirAbs, onBeforeRun]);

  const runPublish = useCallback(async () => {
    if (!draftDirAbs) {
      toast.message("请先打开一篇已落盘的稿件。");
      return;
    }
    const slot = Number(accountSlot);
    if (!Number.isFinite(slot) || slot < 1) {
      toast.message("请选择微信公众号账号槽位。");
      return;
    }
    setPublishing(true);
    try {
      await onBeforeRun?.();
      const root = await resolveWorkspaceRoot();
      if (!root) throw new Error("无法解析工作区根目录");
      const result = await runWechatPublishFullForDraft({
        draftDirAbs,
        workspaceRoot: root,
        accountSlot: slot,
      });
      if (result.ok) {
        toast.success("已推到微信公众号草稿箱");
      } else {
        const detail = (result.stderr || result.stdout).trim().slice(0, 400);
        toast.error(detail || `发布失败（exit ${result.exitCode ?? "?"})`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  }, [accountSlot, draftDirAbs, onBeforeRun]);

  const disabled = !draftDirAbs;

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-relaxed text-slate-400">
        以磁盘最新 article.md 为准；排版主题见上方「排版样式」。生成 HTML 与推草稿箱也可在聊天里让发行代跑，但推荐在此操作。
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-full rounded-xl text-xs"
        disabled={disabled || formatting}
        onClick={() => void runFormat()}
      >
        {formatting ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : null}
        生成微信排版
      </Button>
      <div>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-slate-400">
          推草稿箱 · 微信
        </div>
        <Select value={accountSlot} onValueChange={setAccountSlot} disabled={disabled || slots.length === 0}>
          <SelectTrigger size="sm" className="h-8 w-full rounded-xl text-sm">
            <SelectValue placeholder={slots.length ? "选择账号槽位" : "未配置 WECHAT_N_ 凭证"} />
          </SelectTrigger>
          <SelectContent>
            {slots.map((slot) => (
              <SelectItem key={slot.slot} value={String(slot.slot)}>
                {slot.name ? `${slot.name} · 槽位 ${slot.slot}` : `槽位 ${slot.slot}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        size="sm"
        className="h-8 w-full rounded-xl text-xs"
        disabled={disabled || publishing || slots.length === 0}
        onClick={() => void runPublish()}
      >
        {publishing ? (
          <LoaderCircle className="mr-1.5 size-3.5 animate-spin" />
        ) : (
          <Send className="mr-1.5 size-3.5" />
        )}
        推到公众号草稿箱
      </Button>
    </div>
  );
}
