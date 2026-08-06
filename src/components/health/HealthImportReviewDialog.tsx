/**
 * HealthImportReviewDialog
 *
 * Shown when the user clicks "保存为健康记录" with attached images.
 * Automatically runs AI analysis, lets the user review/edit the extracted
 * observations, then saves everything to the local health database.
 */

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { analyzeHealthImage } from "@/lib/health/health-image-analyzer";
import {
  addHealthAiInterpretation,
  addHealthAttachment,
  addHealthObservations,
  createHealthRecord,
  getOrCreateSelfPerson,
  listHealthPeople,
} from "@/lib/database/health.action";
import type {
  AbnormalFlag,
  HealthAiObservation,
  HealthAiResult,
  HealthPerson,
  HealthRecordType,
} from "@/types/health.type";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AttachedImageLike {
  id: string;
  name: string;
  mimeType: string;
  /** Pure base64 data (no data-URL prefix). */
  data: string;
  size: number;
}

export interface HealthImportReviewDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  images: AttachedImageLike[];
  providerId: string;
  modelId: string;
  providerVariables?: Record<string, string>;
}

// ─── Local types ──────────────────────────────────────────────────────────────

interface EditableObservation extends HealthAiObservation {
  included: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RECORD_TYPE_LABELS: Array<{ value: HealthRecordType; label: string }> = [
  { value: "lab_report", label: "化验单 / 检验报告" },
  { value: "imaging", label: "影像检查" },
  { value: "meal", label: "饮食记录" },
  { value: "medication", label: "用药记录" },
  { value: "symptom", label: "症状记录" },
  { value: "sleep", label: "睡眠记录" },
  { value: "fitness", label: "运动记录" },
  { value: "mood", label: "情绪 / 心理" },
  { value: "note", label: "健康备注" },
  { value: "profile", label: "基础档案" },
  { value: "discharge", label: "出院小结" },
  { value: "surgery", label: "手术记录" },
  { value: "screening", label: "筛查记录" },
];

function flagBadgeVariant(
  flag?: AbnormalFlag
): "default" | "destructive" | "secondary" | "outline" {
  switch (flag) {
    case "high":
    case "low":
      return "destructive";
    case "critical":
      return "destructive";
    case "normal":
      return "secondary";
    default:
      return "outline";
  }
}

function flagLabel(flag?: AbnormalFlag): string {
  switch (flag) {
    case "high":
      return "偏高";
    case "low":
      return "偏低";
    case "critical":
      return "危急";
    case "normal":
      return "正常";
    default:
      return "—";
  }
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HealthImportReviewDialog({
  open,
  onClose,
  onSuccess,
  images,
  providerId,
  modelId,
  providerVariables,
}: HealthImportReviewDialogProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<HealthAiResult | null>(null);

  const [recordType, setRecordType] = useState<HealthRecordType>("lab_report");
  const [occurredAt, setOccurredAt] = useState<string>(todayIsoDate());
  const [title, setTitle] = useState("");
  const [personId, setPersonId] = useState<string>("");
  const [people, setPeople] = useState<HealthPerson[]>([]);

  const [observations, setObservations] = useState<EditableObservation[]>([]);
  const [saving, setSaving] = useState(false);

  // ── Load people on open ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const selfPerson = await getOrCreateSelfPerson();
        const all = await listHealthPeople();
        setPeople(all);
        setPersonId(selfPerson.id);
      } catch (e) {
        console.error("[HealthImport] Failed to load people:", e);
      }
    })();
  }, [open]);

  // ── Run AI analysis on first open ─────────────────────────────────────────
  useEffect(() => {
    if (!open || images.length === 0) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setAiResult(null);

    const imageContents = images.map((img) => ({
      type: "image" as const,
      mimeType: img.mimeType,
      data: img.data,
    }));

    analyzeHealthImage({
      images: imageContents,
      recordType,
      providerId,
      modelId,
      providerVariables,
    })
      .then((result) => {
        setAiResult(result);
        if (result.title) setTitle(result.title);
        if (result.occurredAt) setOccurredAt(result.occurredAt);
        setObservations(
          result.observations.map((obs) => ({ ...obs, included: true }))
        );
      })
      .catch((err) => {
        setAnalyzeError(String(err?.message ?? err));
      })
      .finally(() => setAnalyzing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Reset when closed ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setAiResult(null);
      setAnalyzeError(null);
      setObservations([]);
      setTitle("");
      setOccurredAt(todayIsoDate());
      setRecordType("lab_report");
    }
  }, [open]);

  // ── Observation helpers ────────────────────────────────────────────────────
  function toggleObservation(idx: number) {
    setObservations((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, included: !o.included } : o))
    );
  }

  function updateObservation(idx: number, field: keyof HealthAiObservation, value: string) {
    setObservations((prev) =>
      prev.map((o, i) => {
        if (i !== idx) return o;
        if (field === "value" || field === "referenceLow" || field === "referenceHigh") {
          const num = parseFloat(value);
          return { ...o, [field]: isNaN(num) ? undefined : num };
        }
        return { ...o, [field]: value };
      })
    );
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!personId) {
      toast.error("请选择健康档案人员");
      return;
    }
    setSaving(true);
    try {
      const occurredMs = new Date(occurredAt).getTime() || Date.now();

      // 1. Create record
      const record = await createHealthRecord({
        personId,
        type: recordType,
        occurredAt: occurredMs,
        title: title || (aiResult?.title ?? "健康记录"),
        summary: aiResult?.summary ?? "",
        source: "image",
        confidence: aiResult
          ? aiResult.observations.reduce((s, o) => s + (o.confidence ?? 0), 0) /
            Math.max(aiResult.observations.length, 1)
          : undefined,
        rawText: aiResult?.raw,
        structuredJson: aiResult ? JSON.stringify(aiResult) : undefined,
      });

      // 2. Save attachments via Tauri command
      const workspaceRoot = await invoke<string>("get_niuma_root_dir").catch(() => "");
      for (const img of images) {
        let attachId: string;
        let filePath: string;
        let sizeBytes: number | undefined;

        try {
          const resp = await invoke<{
            id: string;
            filePath?: string;
            sizeBytes?: number;
            file_path?: string;
            size_bytes?: number;
          }>(
            "health_save_attachment",
            {
              request: {
                base64Data: img.data,
                mimeType: img.mimeType,
                extension: extFromMime(img.mimeType),
                workspaceRoot: workspaceRoot || undefined,
              },
            }
          );
          attachId = resp.id;
          filePath = resp.filePath ?? resp.file_path ?? "";
          sizeBytes = resp.sizeBytes ?? resp.size_bytes;
        } catch (e) {
          console.warn("[HealthImport] Failed to save attachment:", e);
          attachId = img.id;
          filePath = "";
          sizeBytes = img.size;
        }

        await addHealthAttachment({
          id: attachId,
          recordId: record.id,
          filePath,
          mimeType: img.mimeType,
          sizeBytes,
        });
      }

      // 3. Save included observations
      const included = observations.filter((o) => o.included);
      if (included.length > 0) {
        await addHealthObservations(
          included.map((o) => ({
            recordId: record.id,
            personId,
            code: o.code,
            displayName: o.displayName,
            valueNum: o.value,
            valueText: o.valueText,
            unit: o.unit,
            referenceLow: o.referenceLow,
            referenceHigh: o.referenceHigh,
            abnormalFlag: o.flag,
            confidence: o.confidence,
            observedAt: occurredMs,
          }))
        );
      }

      // 4. Save AI interpretation
      if (aiResult) {
        await addHealthAiInterpretation({
          recordId: record.id,
          model: modelId,
          resultJson: aiResult.raw,
          summary: aiResult.summary,
          warningsJson: JSON.stringify(aiResult.warnings),
        });
      }

      toast.success("健康记录已保存");
      onSuccess?.();
      onClose();
    } catch (e) {
      console.error("[HealthImport] Save failed:", e);
      toast.error(`保存失败：${String((e as Error)?.message ?? e)}`);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>保存为健康记录</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-2">
          <div className="space-y-4 pb-2">
            {/* Image thumbnails */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((img) => (
                  <img
                    key={img.id}
                    src={`data:${img.mimeType};base64,${img.data}`}
                    alt={img.name}
                    className="h-20 w-20 object-cover rounded border border-border"
                  />
                ))}
              </div>
            )}

            {/* Analyzing state */}
            {analyzing && (
              <div className="text-sm text-muted-foreground animate-pulse">
                正在 AI 解析图片内容，请稍候…
              </div>
            )}

            {analyzeError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded p-2">
                AI 解析失败：{analyzeError}
                <br />
                <span className="text-muted-foreground">
                  您可以手动填写以下信息后保存。
                </span>
              </div>
            )}

            {/* Record metadata */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>记录类型</Label>
                <Select
                  value={recordType}
                  onValueChange={(v) => setRecordType(v as HealthRecordType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECORD_TYPE_LABELS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>检查/记录日期</Label>
                <Input
                  type="date"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>标题</Label>
              <Input
                placeholder="自动填写或手动输入标题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {people.length > 1 && (
              <div className="space-y-1">
                <Label>健康档案</Label>
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择人员" />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}（{p.relation === "self" ? "本人" : p.relation}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* AI summary */}
            {aiResult?.summary && (
              <div className="rounded bg-muted p-3 text-sm">
                <span className="font-medium text-foreground">AI 摘要：</span>
                {aiResult.summary}
              </div>
            )}

            {/* Observations table */}
            {observations.length > 0 && (
              <div className="space-y-1">
                <Label>提取的检测项目（取消勾选可排除）</Label>
                <div className="rounded border divide-y text-sm">
                  {/* Header */}
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 px-3 py-1.5 text-xs text-muted-foreground font-medium">
                    <span />
                    <span>项目名称</span>
                    <span className="text-right">数值</span>
                    <span>单位</span>
                    <span>参考区间</span>
                    <span>标志</span>
                  </div>

                  {observations.map((obs, idx) => (
                    <div
                      key={idx}
                      className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 items-center px-3 py-1.5 ${
                        !obs.included ? "opacity-40" : ""
                      }`}
                    >
                      <Checkbox
                        checked={obs.included}
                        onCheckedChange={() => toggleObservation(idx)}
                      />
                      <span className="truncate">
                        {obs.displayName}
                        {obs.confidence < 0.8 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({Math.round(obs.confidence * 100)}%)
                          </span>
                        )}
                      </span>
                      <Input
                        className="h-6 w-20 text-right px-1 text-xs"
                        value={
                          obs.value !== undefined
                            ? String(obs.value)
                            : obs.valueText ?? ""
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          const num = parseFloat(v);
                          if (!isNaN(num)) {
                            updateObservation(idx, "value", v);
                          } else {
                            updateObservation(idx, "valueText", v);
                          }
                        }}
                      />
                      <span className="text-muted-foreground text-xs w-10">
                        {obs.unit ?? "—"}
                      </span>
                      <span className="text-muted-foreground text-xs w-20">
                        {obs.referenceLow !== undefined || obs.referenceHigh !== undefined
                          ? `${obs.referenceLow ?? "—"} ~ ${obs.referenceHigh ?? "—"}`
                          : "—"}
                      </span>
                      <Badge
                        variant={flagBadgeVariant(obs.flag)}
                        className="text-xs px-1.5 py-0"
                      >
                        {flagLabel(obs.flag)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {aiResult?.warnings && aiResult.warnings.length > 0 && (
              <div className="space-y-1">
                <Label className="text-amber-600">注意事项</Label>
                <ul className="text-sm list-disc pl-4 space-y-0.5 text-amber-700 dark:text-amber-400">
                  {aiResult.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-xs text-muted-foreground border rounded p-2">
              ⚠️ 本功能仅辅助记录健康数据，AI 解析结果可能存在误差。
              请勿依据此数据作出任何医疗决策，如有健康问题请咨询专业医师。
            </p>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={analyzing || saving}>
            {saving ? "保存中…" : "确认保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
