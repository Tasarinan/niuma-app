/**
 * Frontend bridge for the Unified API control plane.
 *
 * Mirrors LLMToolForge's `unifiedApi.ts`: the routing table and config live in
 * the frontend and are pushed to the Rust supervisor, which owns run-state and
 * the in-memory call-log ring buffer.
 *
 * niuma does not bundle the Portkey gateway binary (out of scope), so the actual
 * model requests still flow through niuma's direct cURL-provider transport; the
 * agent runtime reports each call here via {@link logUnifiedCall} so the
 * monitoring UI stays populated.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getStore } from "@/data";

const CONFIG_KEY = "unifiedApiConfig";

export const CALL_LOG_EVENT = "unified://call-log";

export interface UnifiedApiConfig {
  /** Port the gateway would bind to (reserved for when a binary is bundled). */
  port: number;
  /** Optional local bearer key clients must present. Empty = no auth. */
  localKey: string;
  autoStart: boolean;
}

export const DEFAULT_UNIFIED_CONFIG: UnifiedApiConfig = {
  port: 4141,
  localKey: "",
  autoStart: false,
};

/** One route (exposedModel -> upstream) pushed to the supervisor. */
export interface RouteInput {
  exposedModel: string;
  baseUrl: string;
  apiKey: string;
  realModel: string;
  provider: string;
}

export interface UnifiedStatus {
  running: boolean;
  port: number;
  routeCount: number;
  hasLocalKey: boolean;
  models: string[];
  /** Whether an actual gateway sidecar binary is bundled (false for niuma). */
  gatewayBundled: boolean;
}

export interface CallLogRecord {
  id: number;
  ts: number;
  exposedModel: string;
  realModel: string;
  provider: string;
  protocol: string;
  stream: boolean;
  status: number;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  error?: string;
}

export type CallLogInput = Omit<CallLogRecord, "id" | "ts">;

export interface ModelStat {
  model: string;
  count: number;
  errors: number;
  totalTokens: number;
  avgDurationMs: number;
}

export interface UnifiedStats {
  total: number;
  success: number;
  errors: number;
  avgDurationMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  byModel: ModelStat[];
}

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

export async function loadUnifiedConfig(): Promise<UnifiedApiConfig> {
  const stored = await getStore().get<UnifiedApiConfig>(CONFIG_KEY);
  return { ...DEFAULT_UNIFIED_CONFIG, ...(stored ?? {}) };
}

export async function saveUnifiedConfig(
  config: UnifiedApiConfig
): Promise<void> {
  await getStore().set(CONFIG_KEY, config);
}

/** Push the config + routing table to the Rust supervisor. */
export async function pushUnifiedConfig(
  config: UnifiedApiConfig,
  routes: RouteInput[]
): Promise<UnifiedStatus> {
  return invoke<UnifiedStatus>("unified_api_set_config", {
    config: {
      port: config.port,
      localKey: config.localKey || null,
      routes,
    },
  });
}

export async function startUnified(): Promise<UnifiedStatus> {
  return invoke<UnifiedStatus>("unified_api_start");
}

export async function stopUnified(): Promise<UnifiedStatus> {
  return invoke<UnifiedStatus>("unified_api_stop");
}

export async function getUnifiedStatus(): Promise<UnifiedStatus> {
  return invoke<UnifiedStatus>("unified_api_get_status");
}

export async function logUnifiedCall(
  record: CallLogInput
): Promise<CallLogRecord> {
  return invoke<CallLogRecord>("unified_api_log", { record });
}

export async function getUnifiedLogs(): Promise<CallLogRecord[]> {
  return invoke<CallLogRecord[]>("unified_api_get_logs");
}

export async function clearUnifiedLogs(): Promise<void> {
  await invoke("unified_api_clear_logs");
}

export async function getUnifiedStats(): Promise<UnifiedStats> {
  return invoke<UnifiedStats>("unified_api_get_stats");
}

/** Subscribe to live call-log records emitted by the supervisor. */
export async function onCallLog(
  handler: (record: CallLogRecord) => void
): Promise<UnlistenFn> {
  return listen<CallLogRecord>(CALL_LOG_EVENT, (event) => handler(event.payload));
}
