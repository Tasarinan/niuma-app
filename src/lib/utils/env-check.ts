/**
 * Runtime environment pre-flight checks for skill execution.
 *
 * Runs `node --version` and `python3 --version` (+ `python --version` fallback)
 * via the Tauri sandbox to confirm the binaries are on PATH before the PI
 * agent attempts to call skill scripts. Results are cached in localStorage so
 * the check only runs once per session.
 */

import { invoke } from "@tauri-apps/api/core";

const CACHE_KEY = "niuma:env-check";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface BinaryStatus {
  available: boolean;
  version: string;  // e.g. "v22.4.0" or "Python 3.11.6"
  path?: string;
  error?: string;
}

export interface EnvStatus {
  node: BinaryStatus;
  python: BinaryStatus;
  checkedAt: number;
}

interface SandboxRunResponse {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function probeCommand(cmd: string, args: string[]): Promise<BinaryStatus> {
  if (!isTauri()) {
    return { available: false, version: "", error: "not in Tauri" };
  }
  try {
    const result = await invoke<SandboxRunResponse>("run_sandboxed_command", {
      req: {
        command: cmd,
        args,
        sandboxMode: "read-only",
        timeoutMs: 5000,
      },
    });
    if (result.exitCode === 0) {
      const version = (result.stdout || result.stderr).trim().split("\n")[0];
      return { available: true, version };
    }
    return { available: false, version: "", error: result.stderr.trim() || `exit ${result.exitCode}` };
  } catch (e) {
    return { available: false, version: "", error: String(e) };
  }
}

/** Run checks for node + python and return combined status. */
export async function checkEnv(force = false): Promise<EnvStatus> {
  // Return cached result if fresh
  if (!force) {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as EnvStatus;
        if (Date.now() - cached.checkedAt < CACHE_TTL_MS) return cached;
      }
    } catch {
      // ignore
    }
  }

  const [node, python] = await Promise.all([
    probeCommand("node", ["--version"]),
    // Try python3 first, fall back to python
    probeCommand("python3", ["--version"]).then((r) =>
      r.available ? r : probeCommand("python", ["--version"])
    ),
  ]);

  const status: EnvStatus = { node, python, checkedAt: Date.now() };

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(status));
  } catch {
    // ignore
  }

  return status;
}

/** Cached last result (may be null before first check). */
export function getCachedEnvStatus(): EnvStatus | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as EnvStatus) : null;
  } catch {
    return null;
  }
}

/**
 * Returns a short summary string suitable for injecting into the system prompt
 * so the model knows what runtimes are available.
 */
export function envStatusToPromptHint(status: EnvStatus): string {
  const lines: string[] = ["[运行环境]"];
  lines.push(
    status.node.available
      ? `✅ Node.js: ${status.node.version}`
      : `❌ Node.js: 未找到（ima-skill 等需要 Node.js 的技能将无法运行）`,
  );
  lines.push(
    status.python.available
      ? `✅ Python: ${status.python.version}`
      : `❌ Python: 未找到（依赖 Python 的技能将无法运行）`,
  );
  return lines.join("\n");
}
