/**
 * Agent catalog loader
 *
 * Reads agent definitions from the local filesystem via Tauri invoke commands.
 * Mirrors the approach used by niuma (Vue) for skills/loader.ts.
 *
 * The single source of truth is `.niuma/agents/*.md`.
 *
 * Filesystem discovery requires the Tauri runtime.
 */

import { invoke } from "@tauri-apps/api/core";
import { TALENT_AVATAR_ITEMS } from "../talent-avatar";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CatalogAgent {
  /** Stable identity across source formats. */
  id: string;
  /** URL/path-safe identity segment. */
  slug: string;
  /** Source format and schema metadata. */
  schemaVersion: "v1";
  sourceType: "niuma-markdown";
  sourcePath: string;
  /** Source filename, e.g. "alice.md" */
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

interface AgentScanContext {
  teamId?: string;
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function stripFrontmatter(raw: string): string {
  const normalized = normalizeNewlines(raw);
  return normalized.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

function parseFrontmatter(raw: string): Record<string, string> {
  const normalized = normalizeNewlines(raw);
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const item = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!item) continue;
    const key = item[1].trim();
    const value = item[2].trim();
    meta[key] = value.replace(/^['"]|['"]$/g, "");
  }
  return meta;
}

function toSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "agent";
}

function detectSourceType(): CatalogAgent["sourceType"] {
  return "niuma-markdown";
}

function buildIdentity(explicitId: string | undefined, fileName: string, context: AgentScanContext = {}) {
  const withoutExt = fileName.replace(/\.md$/i, "");
  const explicit = explicitId?.trim();
  const teamPrefix = context.teamId ? `${context.teamId}-` : "";
  const seed = context.teamId
    ? explicit?.startsWith(teamPrefix) ? explicit : `${context.teamId}-${explicit || withoutExt}`
    : explicit || withoutExt;
  const slug = toSlug(seed);
  return {
    id: `agent:${slug}`,
    slug,
  };
}

function parseListField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  }
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    }
  } catch {
    // continue with comma split
  }

  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractTitle(content: string, fallbackName: string): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) {
    return heading.replace(/\s+Skill$/i, "").trim();
  }

  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (firstLine) return firstLine.replace(/^#+\s*/, "").trim();

  return fallbackName;
}

function extractDescription(content: string): string {
  const lines = content.split("\n").map((line) => line.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("#") || line.startsWith("```")) continue;
    if (line.startsWith("-") || line.startsWith("*") || line.startsWith("|")) continue;
    return line;
  }
  return "";
}

function markdownToAgent(entry: DirEntry, raw: string, context: AgentScanContext = {}): CatalogAgent {
  const sourceType = detectSourceType();
  const withoutExt = entry.name.replace(/\.md$/i, "");
  const frontmatter = parseFrontmatter(raw);
  const content = stripFrontmatter(raw).trim();
  const title = frontmatter.name?.trim() || extractTitle(content, withoutExt);
  const description = frontmatter.description?.trim() || extractDescription(content);
  const identity = buildIdentity(frontmatter.id, entry.name, context);
  const temperature = Number(frontmatter.temperature);
  const maxTokens = Number(frontmatter.maxTokens);

  return {
    id: identity.id,
    slug: identity.slug,
    schemaVersion: "v1",
    sourceType,
    sourcePath: entry.path,
    file: entry.name,
    name: title,
    role: frontmatter.role?.trim() || (context.teamId ? title : "Specialist"),
    avatar: frontmatter.avatar?.trim() || "",
    description,
    providerId: frontmatter.providerId?.trim() || "",
    modelId: frontmatter.modelId?.trim() || "",
    temperature: Number.isFinite(temperature) ? temperature : undefined,
    maxTokens: Number.isFinite(maxTokens) ? maxTokens : undefined,
    sandboxMode: frontmatter.sandboxMode?.trim() || undefined,
    enabledInternalTools: parseListField(frontmatter.enabledInternalTools),
    enabledSkillIds: parseListField(frontmatter.enabledSkillIds),
    enabledMcpServerIds: parseListField(frontmatter.enabledMcpServerIds),
    workspacePath: frontmatter.workspacePath?.trim() || "",
    systemPrompt: content,
  };
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

async function scanAgentsDir(dir: string, context: AgentScanContext = {}): Promise<CatalogAgent[]> {
  if (!dir) return [];
  let entries: DirEntry[];
  try {
    entries = await invoke<DirEntry[]>("list_directory", { path: dir });
  } catch {
    return [];
  }

  const dataFiles = entries.filter((e) => {
    if (e.isDir) return false;
    const lower = e.name.toLowerCase();
    if (lower === "index.json" || lower === "readme.md" || lower.startsWith("_")) return false;
    return lower.endsWith(".md");
  });

  const agents: CatalogAgent[] = [];
  for (const entry of dataFiles) {
    try {
      const raw = await invoke<string>("read_text_file", { path: entry.path });
      agents.push(markdownToAgent(entry, raw, context));
    } catch {
      // skip malformed files
    }
  }
  return agents;
}

async function scanTeamAgentDirs(rootDir: string): Promise<CatalogAgent[]> {
  if (!rootDir) return [];
  const separator = rootDir.includes("/") ? "/" : "\\";
  const teamsDir = `${rootDir}${separator}.niuma${separator}teams`;
  let teamEntries: DirEntry[];
  try {
    teamEntries = await invoke<DirEntry[]>("list_directory", { path: teamsDir });
  } catch {
    return [];
  }

  const results = await Promise.allSettled(
    teamEntries
      .filter((entry) => entry.isDir)
      .map((entry) => scanAgentsDir(`${entry.path}${separator}agents`, { teamId: entry.name })),
  );

  return results
    .filter((result): result is PromiseFulfilledResult<CatalogAgent[]> => result.status === "fulfilled")
    .flatMap((result) => result.value);
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
    cache = [];
    cacheTimestamp = now;
    return cache;
  }

  const agentsDir = await invoke<string>("get_niuma_agents_dir").catch(() => "");
  const rootDir = await invoke<string>("get_niuma_root_dir").catch(() => "");
  const builtinAgents = await scanAgentsDir(agentsDir);
  const teamAgents = await scanTeamAgentDirs(rootDir);

  const map = new Map<string, CatalogAgent>();
  for (const a of [...builtinAgents, ...teamAgents]) {
    map.set(a.id, a);
    map.set(`name:${a.name.toLowerCase()}`, a);
  }

  const dedup = new Map<string, CatalogAgent>();
  for (const item of map.values()) {
    dedup.set(item.id, item);
  }
  const merged = Array.from(dedup.values());
  // Assign avatars deterministically by sorted position for agents that lack one
  const sorted = [...merged].sort((a, b) => a.file.localeCompare(b.file));
  sorted.forEach((agent, i) => {
    if (!agent.avatar) {
      agent.avatar = TALENT_AVATAR_ITEMS[i % TALENT_AVATAR_ITEMS.length]?.avatarUrl ?? "🤖";
    }
  });
  cache = sorted;
  cacheTimestamp = now;
  return cache;
}
