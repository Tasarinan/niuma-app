/**
 * Provider registry — direct registration, no cURL parsing.
 *
 * Each entry declares the static facts about a provider (baseUrl, wire API,
 * vision support). The user only needs to supply { apiKey, model }.
 * Custom providers can be added at runtime via `registerCustomProvider`.
 *
 * Usage:
 *   const conn = resolveConnection("openai", { apiKey: "sk-...", model: "gpt-4o" });
 *   // → ProviderConnection ready for createDirectRuntime / createAgentRuntime
 */

import type { AgentApiKind } from "@/types";
import type { ProviderConnection } from "@/lib/agent/connection";

// ─── Provider definition ─────────────────────────────────────────────────────

export interface ProviderDef {
  /** Unique stable id — used as the `providerId` in ProviderConnection. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** OpenAI-compat or Anthropic Messages wire format. */
  api: AgentApiKind;
  /** Base URL (pi-ai will append /chat/completions or /messages). */
  baseUrl: string;
  /** Whether an API key is required (false for local providers like Ollama). */
  requiresKey: boolean;
  /** Suggested chat / vision (text) model IDs. */
  suggestedModels: string[];
  /** Suggested image-generation model IDs. */
  suggestedImageModels?: string[];
  /** Suggested video-generation model IDs. */
  suggestedVideoModels?: string[];
  /** Whether models from this provider typically accept image input. */
  supportsVision: boolean;
  /** Provider type: api = needs key, web = zero-token browser session. */
  type: "api" | "web" | "local";
}

// ─── Built-in provider catalog ───────────────────────────────────────────────

const BUILTIN_PROVIDERS: ProviderDef[] = [
  // ── Anthropic ──────────────────────────────────────────────────────────────
  {
    id: "anthropic",
    name: "Anthropic",
    api: "anthropic-messages",
    baseUrl: "https://api.anthropic.com/v1",
    requiresKey: true,
    suggestedModels: [
      "claude-opus-4-5",
      "claude-sonnet-4-5",
      "claude-haiku-3-5",
    ],
    supportsVision: true,
    type: "api",
  },
  // ── Kimi (Moonshot) ──────────────────────────────────────────────────────────
  {
    id: "kimi",
    name: "Kimi",
    api: "openai-completions",
    baseUrl: "https://api.moonshot.cn/v1",
    requiresKey: true,
    suggestedModels: [
      "moonshot-v1-8k",
      "moonshot-v1-32k",
      "moonshot-v1-128k",
    ],
    supportsVision: true,
    type: "api",
  },
  // ── DeepSeek ───────────────────────────────────────────────────────────────
  {
    id: "deepseek",
    name: "DeepSeek",
    api: "openai-completions",
    baseUrl: "https://api.deepseek.com/v1",
    requiresKey: true,
    suggestedModels: ["deepseek-chat", "deepseek-reasoner"],
    supportsVision: false,
    type: "api",
  },
  // ── Groq ───────────────────────────────────────────────────────────────────
  {
    id: "groq",
    name: "Groq",
    api: "openai-completions",
    baseUrl: "https://api.groq.com/openai/v1",
    requiresKey: true,
    suggestedModels: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "moonshotv3-32b",
    ],
    supportsVision: false,
    type: "api",
  },
  // ── OpenRouter ─────────────────────────────────────────────────────────────
  {
    id: "openrouter",
    name: "OpenRouter",
    api: "openai-completions",
    baseUrl: "https://openrouter.ai/api/v1",
    requiresKey: true,
    suggestedModels: [
      "anthropic/claude-sonnet-4-5",
      "google/gemini-2.5-flash",
      "meta-llama/llama-3.3-70b-instruct",
    ],
    supportsVision: true,
    type: "api",
  },
  // ── NVIDIA NIM ─────────────────────────────────────────────────────────────
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    api: "openai-completions",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    requiresKey: true,
    suggestedModels: [
      "meta/llama-3.3-70b-instruct",
      "nvidia/llama-3.1-nemotron-ultra-253b-v1",
      "mistralai/mistral-large-2-instruct",
    ],
    supportsVision: false,
    type: "api",
  },
  // ── Agnes AI ───────────────────────────────────────────────────────────────
  {
    id: "agnes",
    name: "Agnes AI",
    api: "openai-completions",
    baseUrl: "https://apihub.agnes-ai.com/v1",
    requiresKey: true,
    suggestedModels: [
      "agnes-2.5-flash",
    ],
    suggestedImageModels: ["agnes-image-2.5-flash"],
    suggestedVideoModels: ["agnes-video-v2.0"],
    supportsVision: true,
    type: "api",
  },
  // ── Zero-token / browser session providers ─────────────────────────────────
  {
    id: "zt-doubao",
    name: "豆包 Doubao (浏览器登录)",
    api: "openai-completions",
    baseUrl: "https://www.doubao.com",
    requiresKey: false,
    suggestedModels: ["doubao-pro-4k"],
    supportsVision: false,
    type: "web",
  },
  {
    id: "zt-deepseek",
    name: "DeepSeek (浏览器登录)",
    api: "openai-completions",
    baseUrl: "https://chat.deepseek.com",
    requiresKey: false,
    suggestedModels: ["deepseek-chat"],
    supportsVision: false,
    type: "web",
  },
  {
    id: "zt-qwen",
    name: "Qwen (浏览器登录)",
    api: "openai-completions",
    baseUrl: "https://chat.qwen.ai",
    requiresKey: false,
    suggestedModels: ["qwen-max"],
    supportsVision: false,
    type: "web",
  },
];

// ─── Runtime-registered custom providers ─────────────────────────────────────

const customProviders = new Map<string, ProviderDef>();

/** Register a custom provider at runtime (e.g. from user settings). */
export function registerCustomProvider(def: ProviderDef): void {
  customProviders.set(def.id, def);
}

/** Remove a previously registered custom provider. */
export function unregisterCustomProvider(id: string): void {
  customProviders.delete(id);
}

/** All providers: built-ins + user-registered custom ones. */
export function getAllProviders(): ProviderDef[] {
  return [...BUILTIN_PROVIDERS, ...customProviders.values()];
}

export function getProvider(id: string): ProviderDef | undefined {
  return customProviders.get(id) ?? BUILTIN_PROVIDERS.find((p) => p.id === id);
}

// ─── Direct resolution (no cURL parsing) ─────────────────────────────────────

export interface ProviderCredential {
  /** API key. Empty string for local/zero-token providers. */
  apiKey: string;
  /** Chat / vision model identifier. */
  model: string;
  /** Image-generation model identifier. */
  imageModel?: string;
  /** Video-generation model identifier. */
  videoModel?: string;
  /**
   * Override the provider's built-in baseUrl.
   * Useful for self-hosted deployments or proxy endpoints.
   */
  baseUrlOverride?: string;
}

/**
 * Resolve a provider id + credential into a concrete `ProviderConnection`
 * without any cURL parsing.
 *
 * @throws if the provider id is not registered or model is missing.
 */
export function resolveConnection(
  providerId: string,
  cred: ProviderCredential
): ProviderConnection {
  const def = getProvider(providerId);
  if (!def) {
    throw new Error(
      `Unknown provider "${providerId}". ` +
        `Register it first with registerCustomProvider() or use a built-in id: ` +
        getAllProviders()
          .map((p) => p.id)
          .join(", ")
    );
  }

  const model = cred.model.trim();
  if (!model) {
    throw new Error(`Provider "${providerId}": model must not be empty.`);
  }

  if (def.requiresKey && !cred.apiKey.trim()) {
    throw new Error(
      `Provider "${providerId}" requires an API key. Please add it in Settings → Providers.`
    );
  }

  const baseUrl = (cred.baseUrlOverride ?? "").trim() || def.baseUrl;

  return {
    providerId: def.id,
    api: def.api,
    baseUrl,
    apiKey: cred.apiKey.trim(),
    model,
    supportsVision: def.supportsVision,
    host: new URL(baseUrl).host,
  };
}

/**
 * Fetch available model IDs from the provider's `/models` endpoint.
 * Returns an empty array on failure (network error, auth error, etc.).
 */
export async function fetchModels(
  providerId: string,
  apiKey?: string,
  baseUrlOverride?: string
): Promise<string[]> {
  const def = getProvider(providerId);
  if (!def) return [];
  const baseUrl = (baseUrlOverride ?? "").trim() || def.baseUrl;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey?.trim()) {
    if (def.api === "anthropic-messages") {
      headers["x-api-key"] = apiKey.trim();
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["Authorization"] = `Bearer ${apiKey.trim()}`;
    }
  }
  try {
    const res = await fetch(`${baseUrl}/models`, { headers });
    if (!res.ok) return [];
    const json = await res.json();
    // OpenAI-compat: { data: [{ id }] }
    if (Array.isArray(json?.data)) {
      return json.data.map((m: { id: string }) => m.id).filter(Boolean);
    }
    // Ollama: { models: [{ name }] }
    if (Array.isArray(json?.models)) {
      return json.models.map((m: { name?: string; id?: string }) => m.name ?? m.id ?? "").filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}
