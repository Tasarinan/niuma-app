import { ensureAgentFetch } from "@/lib/agent/agent-fetch";
import { getProvider } from "@/lib/providers/registry";
import {
  getActiveApiProvider,
  getActiveProvider,
  getProviderConfig,
} from "@/lib/providers/storage";

export interface ProviderMediaConfig {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  textModel: string;
  imageModel: string;
  videoModel: string;
}

export function resolveProviderMedia(providerId?: string): ProviderMediaConfig {
  const active = getActiveApiProvider() ?? getActiveProvider();
  const id = providerId || active?.providerId;
  if (!id) {
    throw new Error("没有激活的 API 提供方，请先在设置里保存。");
  }
  const def = getProvider(id);
  if (!def) {
    throw new Error(`未知 Provider: ${id}`);
  }
  const stored = getProviderConfig(id);
  const apiKey = (stored?.apiKey ?? "").trim();
  if (def.requiresKey && !apiKey) {
    throw new Error(`Provider "${id}" 需要 API Key。请在设置 → API 提供商中填写。`);
  }
  const baseUrl = (stored?.baseUrlOverride ?? "").trim() || def.baseUrl;
  return {
    providerId: id,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    textModel: (stored?.model || def.suggestedModels[0] || "").trim(),
    imageModel: (stored?.imageModel || def.suggestedImageModels?.[0] || "").trim(),
    videoModel: (stored?.videoModel || def.suggestedVideoModels?.[0] || "").trim(),
  };
}

function authHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function bytesFromImageResponse(json: unknown, fallbackUrl?: string): Promise<Uint8Array> {
  const data = (json as { data?: Array<{ b64_json?: string | null; url?: string | null }> })?.data?.[0];
  const b64 = data?.b64_json;
  if (b64) return decodeBase64(b64);
  const url = data?.url || fallbackUrl;
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下载生成图片失败: HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  throw new Error("生图接口没有返回 b64_json 或 url");
}

export async function generateProviderImage(input: {
  prompt: string;
  referenceDataUrl?: string;
  providerId?: string;
}): Promise<Uint8Array> {
  const media = resolveProviderMedia(input.providerId);
  if (!media.imageModel) {
    throw new Error("还没有选择图片模型。请在设置 → API 提供商里选择生图模型。");
  }
  const host = new URL(media.baseUrl).host;
  await ensureAgentFetch(host);
  const agnes = media.providerId === "agnes" || media.imageModel.includes("agnes-image");
  const body = agnes
    ? {
        model: media.imageModel,
        prompt: input.prompt,
        size: "1K",
        ratio: "16:9",
        return_base64: true,
        extra_body: {
          response_format: "b64_json",
          ...(input.referenceDataUrl ? { image: [input.referenceDataUrl] } : {}),
        },
      }
    : {
        model: media.imageModel,
        prompt: input.prompt,
        size: "1024x1024",
        response_format: "b64_json",
      };
  const res = await fetch(`${media.baseUrl}/images/generations`, {
    method: "POST",
    headers: authHeaders(media.apiKey),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => res.statusText)).slice(0, 240);
    throw new Error(`生图失败: HTTP ${res.status} ${detail}`);
  }
  return bytesFromImageResponse(await res.json());
}
