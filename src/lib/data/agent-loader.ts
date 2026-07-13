/**
 * Agent catalog loader
 *
 * Reads agent definitions from the local filesystem via Tauri invoke commands.
 * Mirrors the approach used by niuma (Vue) for skills/loader.ts.
 *
 * Scan priority (last wins / user overrides built-in by name):
 *   1. Built-in agents  (clawpacks/agents/*.json)
 *   2. User agents      (appLocalDataDir/user-customization/agents/*.json)
 *
 * Falls back to HTTP fetch (/clawpacks/agents/) when running in a browser
 * (non-Tauri) context.
 */

import { invoke } from "@tauri-apps/api/core";
import { TALENT_AVATAR_ITEMS } from "../talent-avatar";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CatalogAgent {
  /** Source filename, e.g. "alice.json" */
  file: string;
  name: string;
  role: string;
  avatar: string;
  description: string;
  systemPrompt?: string;
  providerId?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  sandboxMode?: string;
  enabledInternalTools?: string[];
  enabledSkillIds?: string[];
  enabledMcpServerIds?: string[];
  workspacePath?: string;
}

interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

// ─── Cache ───────────────────────────────────────────────────────────────────

let cache: CatalogAgent[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

export function invalidateAgentCatalogCache(): void {
  cache = null;
}

// ─── Filesystem scan ─────────────────────────────────────────────────────────

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function scanAgentsDir(dir: string): Promise<CatalogAgent[]> {
  if (!dir) return [];
  let entries: DirEntry[];
  try {
    entries = await invoke<DirEntry[]>("list_directory", { path: dir });
  } catch {
    return [];
  }

  const jsonFiles = entries.filter(
    (e) => !e.isDir && e.name.endsWith(".json") && e.name !== "index.json"
  );

  const agents: CatalogAgent[] = [];
  for (const entry of jsonFiles) {
    try {
      const raw = await invoke<string>("read_text_file", { path: entry.path });
      const data = JSON.parse(raw) as Record<string, unknown>;
      agents.push({ ...(data as Omit<CatalogAgent, "file">), file: entry.name });
    } catch {
      // skip malformed files
    }
  }
  return agents;
}

// ─── HTTP fallback (browser dev) ─────────────────────────────────────────────

async function fetchCatalogHttp(): Promise<CatalogAgent[]> {
  try {
    const indexRes = await fetch("/clawpacks/agents/index.json");
    if (!indexRes.ok) return [];
    const files: string[] = await indexRes.json();
    const agents = await Promise.all(
      files.map(async (file) => {
        try {
          const res = await fetch(`/clawpacks/agents/${file}`);
          if (!res.ok) return null;
          const data = await res.json();
          return { ...data, file } as CatalogAgent;
        } catch {
          return null;
        }
      })
    );
    return agents.filter((a): a is CatalogAgent => a !== null);
  } catch {
    return [];
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Load the full agent catalog.
 * Results are cached for 30 seconds; call `invalidateAgentCatalogCache()` to
 * force a fresh scan (e.g. after installing a new agent).
 */
export async function loadAgentCatalog(): Promise<CatalogAgent[]> {
  const now = Date.now();
  if (cache && now - cacheTimestamp < CACHE_TTL_MS) {
    return cache;
  }

  if (!isTauri()) {
    const result = await fetchCatalogHttp();
    result.forEach((agent, i) => {
      if (!agent.avatar && TALENT_AVATAR_ITEMS.length > 0) {
        agent.avatar = TALENT_AVATAR_ITEMS[i % TALENT_AVATAR_ITEMS.length].avatarUrl;
      }
    });
    cache = result;
    cacheTimestamp = now;
    return result;
  }

  // Tauri: scan built-in + user directories
  const [builtinDir, userDir] = await Promise.all([
    invoke<string>("get_clawpacks_agents_dir").catch(() => ""),
    invoke<string>("get_user_agents_dir").catch(() => ""),
  ]);

  const [builtinAgents, userAgents] = await Promise.all([
    scanAgentsDir(builtinDir),
    scanAgentsDir(userDir),
  ]);

  // User agents override built-in agents with the same name
  const map = new Map<string, CatalogAgent>(
    builtinAgents.map((a) => [a.name.toLowerCase(), a])
  );
  for (const a of userAgents) {
    map.set(a.name.toLowerCase(), a);
  }

  const merged = Array.from(map.values());
  // Assign avatars deterministically by sorted position for agents that lack one
  const sorted = [...merged].sort((a, b) => a.file.localeCompare(b.file));
  sorted.forEach((agent, i) => {
    if (!agent.avatar && TALENT_AVATAR_ITEMS.length > 0) {
      agent.avatar = TALENT_AVATAR_ITEMS[i % TALENT_AVATAR_ITEMS.length].avatarUrl;
    }
  });
  cache = sorted;
  cacheTimestamp = now;
  return cache;
}
