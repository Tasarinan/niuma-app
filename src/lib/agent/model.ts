/**
 * Build a pi-ai `Model` from a resolved {@link ProviderConnection}.
 *
 * The provider id is fixed per runtime (`niuma-direct`); the concrete API
 * family (OpenAI Chat Completions vs Anthropic Messages) is carried on the
 * model so the runtime can register the matching pi-ai API.
 */

import type { Model } from "@earendil-works/pi-ai";
import type { AgentApiKind } from "@/types";
import type { ProviderConnection } from "./connection";

export const DIRECT_PROVIDER_ID = "niuma-direct";

/** Fallbacks when the provider exposes no capability metadata. */
const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 8_192;

export interface BuildPiModelOptions {
  contextWindow?: number;
  maxTokens?: number;
}

export function buildPiModel(
  conn: ProviderConnection,
  options: BuildPiModelOptions = {}
): Model<AgentApiKind> {
  const input: ("text" | "image")[] = conn.supportsVision
    ? ["text", "image"]
    : ["text"];

  return {
    id: conn.model,
    name: conn.model,
    api: conn.api,
    provider: DIRECT_PROVIDER_ID,
    baseUrl: conn.baseUrl,
    reasoning: false,
    input,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: options.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
    maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
  } as Model<AgentApiKind>;
}
