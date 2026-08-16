/**
 * Shared helpers for agent tool implementations.
 */

import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { TextContent } from "@earendil-works/pi-ai";

/** True when running inside the Tauri desktop shell. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Strip the Windows extended-path prefix (\\?\) that Rust's path::canonicalize()
 * may add. Node.js does not handle \\?\ correctly in process.cwd() or __dirname,
 * causing `EISDIR: illegal operation on a directory, lstat 'C:'`.
 */
export function normalizeTauriPath(p: string): string {
  // \\?\ prefix (extended-length Windows path)
  if (p.startsWith("\\\\?\\")) return p.slice(4);
  // //?/ variant sometimes seen in MSYS/Cygwin environments
  if (p.startsWith("//?/")) return p.slice(4);
  return p;
}

/** Thin wrapper around the Tauri `invoke` API (lazily imported). */
export async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (!isTauri()) {
    throw new Error(`命令 ${cmd} 仅在桌面端可用`);
  }
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return tauriInvoke<T>(cmd, args);
}

export function text(value: string): TextContent {
  return { type: "text", text: value };
}

/** Build a simple text tool result. */
export function textResult<T = unknown>(value: string, details?: T): AgentToolResult<T> {
  return { content: [text(value)], details: details as T };
}
