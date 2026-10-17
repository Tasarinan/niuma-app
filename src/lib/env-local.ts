import { invoke } from "@tauri-apps/api/core";
import { parseDotenv } from "@/lib/wechat/accounts";

/** Parse `.env` / `.env.local` text (no secrets in logs). */
export function parseEnvFile(content: string): Record<string, string> {
  return parseDotenv(content);
}

function parentDir(path: string): string | null {
  const normalized = path.replace(/[/\\]+$/, "");
  const idx = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  if (idx <= 0) return null;
  return normalized.slice(0, idx);
}

/**
 * Read workspace `.env.local`, walking up from `get_niuma_root_dir` when dev exe
 * sits under `target/debug` without a local env file.
 */
export async function readWorkspaceEnvLocal(): Promise<Record<string, string>> {
  const root = await invoke<string>("get_niuma_root_dir").catch(() => "");
  if (!root.trim()) return {};

  const sep = root.includes("\\") ? "\\" : "/";
  const candidates: string[] = [];
  let dir: string | null = root.replace(/[/\\]+$/, "");
  for (let depth = 0; depth < 8 && dir; depth += 1) {
    candidates.push(`${dir}${sep}.env.local`);
    dir = parentDir(dir);
  }

  for (const path of candidates) {
    try {
      const raw = await invoke<string>("read_text_file", { path });
      if (raw.trim()) return parseEnvFile(raw);
    } catch {
      // try parent
    }
  }
  return {};
}
