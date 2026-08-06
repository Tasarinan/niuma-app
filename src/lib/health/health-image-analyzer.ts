/**
 * Health image AI analyzer.
 *
 * Sends base64 images to the configured AI provider and parses structured
 * health data from the response.  Uses `createAgentRuntime` directly so it
 * works outside of any React hook context.
 */

import type { ImageContent } from "@earendil-works/pi-ai";
import type { AgentDefinition } from "@/types";
import { createAgentRuntime } from "@/lib/agent/runtime";
import type { HealthAiObservation, HealthAiResult, HealthRecordType } from "@/types/health.type";

// ─── System prompts per record type ──────────────────────────────────────────

const SYSTEM_PROMPTS: Partial<Record<HealthRecordType, string>> = {
  lab_report: `你是一个医学检验报告解析助手。
用户上传了一张检验报告图片。请提取所有检测项目，并以严格的 JSON 格式返回，不要包含任何其他文字。

输出格式：
{
  "title": "报告标题（如有）",
  "occurredAt": "YYYY-MM-DD（检验日期，若无则为null）",
  "summary": "一句话简要概括本次检验的关键发现",
  "observations": [
    {
      "code": "项目英文代码或缩写（如 WBC、HGB、GLU）",
      "displayName": "项目中文名称",
      "value": 数字型数值（若不是数字则为null）,
      "valueText": "文本型结果（若为数字则为null）",
      "unit": "单位",
      "referenceLow": 参考值下限（数字，若无则null）,
      "referenceHigh": 参考值上限（数字，若无则null）,
      "flag": "high|low|critical|normal|unknown",
      "confidence": 0.0~1.0
    }
  ],
  "warnings": ["需要注意的项目提示（不得作出诊断）"]
}

重要规则：
- 只输出 JSON，不要有任何其他文字、markdown代码块标记
- 不要诊断疾病
- 不要给出用药或治疗建议
- 无法识别的字段设为 null`,

  imaging: `你是一个医学影像报告解析助手。
用户上传了一张影像检查报告图片（CT/MRI/X光/超声等）。请提取关键信息并以严格 JSON 格式返回。

输出格式：
{
  "title": "检查名称",
  "occurredAt": "YYYY-MM-DD（检查日期，若无则null）",
  "summary": "一句话概括检查结论",
  "observations": [],
  "warnings": ["需要随访或注意的内容（不得诊断）"]
}

只输出 JSON。不要诊断。无法确认的字段设为 null。`,

  meal: `你是一个饮食记录助手。
用户上传了一张食物/餐食照片。请识别图中的食物，估算分量、热量和主要营养素，以严格 JSON 格式返回。

输出格式：
{
  "title": "餐食描述（如"午餐·米饭+番茄鸡蛋"）",
  "occurredAt": null,
  "summary": "本餐食物概述及总热量估算",
  "observations": [
    {
      "code": "FOOD_<食物名>",
      "displayName": "食物名称",
      "value": 重量克数（估算）,
      "valueText": null,
      "unit": "g",
      "referenceLow": null,
      "referenceHigh": null,
      "flag": "normal",
      "confidence": 0.0~1.0
    },
    {
      "code": "ENERGY",
      "displayName": "总热量（估算）",
      "value": 卡路里数,
      "valueText": null,
      "unit": "kcal",
      "referenceLow": null,
      "referenceHigh": null,
      "flag": "normal",
      "confidence": 0.7
    }
  ],
  "warnings": []
}

只输出 JSON。估算值请标注较低 confidence。无法识别的食物可在 displayName 中标注"未知食物"。`,

  medication: `你是一个用药记录助手。
用户上传了一张药品或处方图片。请提取药品信息并以严格 JSON 格式返回。

输出格式：
{
  "title": "药品名称",
  "occurredAt": "YYYY-MM-DD（处方日期，若无则null）",
  "summary": "用药信息概述",
  "observations": [
    {
      "code": "MED_<药品名>",
      "displayName": "药品通用名",
      "value": null,
      "valueText": "剂量 + 用法（如 500mg 每日3次饭后服用）",
      "unit": null,
      "referenceLow": null,
      "referenceHigh": null,
      "flag": "normal",
      "confidence": 0.0~1.0
    }
  ],
  "warnings": ["注意事项（不得修改医嘱）"]
}

只输出 JSON。不要给出额外药物建议。无法确认的字段设为 null。`,
};

const DEFAULT_SYSTEM_PROMPT = `你是一个健康记录助手。
用户上传了一张健康相关图片。请提取可识别的信息并以严格 JSON 格式返回。

输出格式：
{
  "title": "图片内容标题",
  "occurredAt": null,
  "summary": "图片内容一句话描述",
  "observations": [],
  "warnings": []
}

只输出 JSON。无法确认的字段设为 null。`;

// ─── JSON extraction helper ───────────────────────────────────────────────────

/** Resize + re-encode image to JPEG ≤1280px before sending to the AI.
 *  Reduces base64 payload from ~5 MB to ~200-400 KB for typical phone photos.
 */
async function compressImageForAnalysis(img: ImageContent): Promise<ImageContent> {
  if (typeof document === "undefined") return img; // non-browser context
  const MAX_DIM = 1280;
  const QUALITY = 0.82;
  return new Promise((resolve) => {
    const src = `data:${img.mimeType};base64,${img.data}`;
    const image = new Image();
    image.onload = () => {
      let { width, height } = image;
      if (width <= MAX_DIM && height <= MAX_DIM) {
        resolve(img); // already small enough
        return;
      }
      const scale = MAX_DIM / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(img); return; }
      ctx.drawImage(image, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
      const base64 = dataUrl.split(",")[1] ?? img.data;
      resolve({ type: "image", mimeType: "image/jpeg", data: base64 });
    };
    image.onerror = () => resolve(img); // fallback: use original
    image.src = src;
  });
}


function extractJson(text: string): unknown {
  // Try parsing directly first
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip markdown code fences
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch {
        // fall through
      }
    }
    // Find first `{` ... last `}`
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
    return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface AnalyzeHealthImageOptions {
  images: ImageContent[];
  recordType: HealthRecordType;
  providerId: string;
  modelId: string;
  providerVariables?: Record<string, string>;
}

export async function analyzeHealthImage(
  opts: AnalyzeHealthImageOptions
): Promise<HealthAiResult> {
  const systemPrompt =
    SYSTEM_PROMPTS[opts.recordType] ?? DEFAULT_SYSTEM_PROMPT;

  const def: AgentDefinition = {
    id: "health-image-analyzer",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: "Health Image Analyzer",
    description: "Analyzes health-related images and extracts structured data.",
    providerId: opts.providerId,
    modelId: opts.modelId,
    systemPrompt,
    enabledInternalTools: [],
    enabledSkillIds: [],
    enabledMcpServerIds: [],
    sandboxMode: "read-only",
    temperature: 0.1,
    maxTokens: 2048,
    workspacePath: "",
  };

  let finalText = "";
  let errorMsg: string | null = null;

  const runtime = await createAgentRuntime(
    def,
    {
      onAssistantDelta: (delta) => {
        finalText += delta;
      },
      onError: (msg) => {
        errorMsg = msg;
      },
    },
    {
      skills: [],
      mcpServers: [],
      providerVariables: opts.providerVariables ?? {},
    }
  );

  // Compress images before sending to reduce payload and avoid proxy timeouts
  const compressedImages = await Promise.all(opts.images.map(compressImageForAnalysis));
  await runtime.prompt("请分析上传的图片并返回 JSON。", compressedImages);
  await runtime.waitForIdle();

  if (errorMsg) {
    throw new Error(errorMsg);
  }

  const parsed = extractJson(finalText);

  // Build result with safe fallbacks
  const p = (parsed as Record<string, unknown> | null) ?? {};

  const rawObservations = Array.isArray(p.observations) ? p.observations : [];
  const observations: HealthAiObservation[] = rawObservations
    .filter((o): o is Record<string, unknown> => o !== null && typeof o === "object")
    .map((o) => ({
      code: String(o.code ?? "UNKNOWN"),
      displayName: String(o.displayName ?? o.code ?? "未知项目"),
      value: typeof o.value === "number" ? o.value : undefined,
      valueText: typeof o.valueText === "string" && o.valueText ? o.valueText : undefined,
      unit: typeof o.unit === "string" && o.unit ? o.unit : undefined,
      referenceLow: typeof o.referenceLow === "number" ? o.referenceLow : undefined,
      referenceHigh: typeof o.referenceHigh === "number" ? o.referenceHigh : undefined,
      flag: (["low", "high", "critical", "normal", "unknown"].includes(String(o.flag))
        ? o.flag
        : "unknown") as HealthAiObservation["flag"],
      confidence: typeof o.confidence === "number" ? Math.min(1, Math.max(0, o.confidence)) : 0.7,
    }));

  const warnings = Array.isArray(p.warnings)
    ? p.warnings.filter((w): w is string => typeof w === "string")
    : [];

  return {
    recordType: opts.recordType,
    occurredAt:
      typeof p.occurredAt === "string" && p.occurredAt ? p.occurredAt : undefined,
    title: typeof p.title === "string" && p.title ? p.title : undefined,
    summary: typeof p.summary === "string" ? p.summary : "",
    observations,
    warnings,
    raw: finalText,
  };
}
