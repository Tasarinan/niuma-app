/**
 * Provider connection — registry-based, no cURL parsing.
 *
 * Resolves a provider id + stored credentials into a Pi-ready ProviderConnection
 * using the direct-registration registry (src/lib/providers/registry.ts).
 */

import {
  getAllProviders,
  resolveConnection as registryResolve,
} from "@/lib/providers/registry";
import {
  getProviderConfig,
  getActiveProvider,
} from "@/lib/providers/storage";
import type { AgentApiKind } from "@/types";

export interface ProviderConnection {
  providerId: string;
  api: AgentApiKind;
  baseUrl: string;
  apiKey: string;
  model: string;
  supportsVision: boolean;
  host: string;
}

/** All registered providers (built-ins + custom). */
export function getAllAiProviders(): { id: string; name: string }[] {
  return getAllProviders().map((p) => ({ id: p.id, name: p.name }));
}

/**
 * Resolve a provider id + legacy variables map into a ProviderConnection.
 * Registry storage credentials take precedence over variables.
 */
export function resolveProviderConnection(
  providerId: string,
  variables: Record<string, string>,
  modelOverride?: string
): ProviderConnection {
  const stored = getProviderConfig(providerId);
  const apiKey = (stored?.apiKey ?? variables.API_KEY ?? variables.api_key ?? "").trim();
  const model = (
    modelOverride ??
    stored?.model ??
    variables.MODEL ??
    variables.model ??
    ""
  ).trim();
  const baseUrlOverride = stored?.baseUrlOverride ?? variables.BASE_URL ?? undefined;

  return registryResolve(providerId, { apiKey, model, baseUrlOverride });
}

/** Resolve the currently active provider from registry storage. */
export function resolveActiveConnection(): ProviderConnection {
  const active = getActiveProvider();
  if (!active) {
    throw new Error("没有激活的 Provider，请在 Settings → Providers 中配置");
  }
  return resolveProviderConnection(active.providerId, {}, active.model);
}
