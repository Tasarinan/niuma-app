/**
 * Agent catalog loader
 *
 * Reads agent definitions from the local filesystem via Tauri invoke commands.
 * Mirrors the approach used by niuma (Vue) for skills/loader.ts.
 *
 * Agents are discovered under `.niuma/teams/<teamId>/agents/` (including `main`).
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
  /** True when the agent was loaded from .niuma/teams/<teamId>/agents/. */
  fromTeams?: boolean;
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
  const lines = match[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const item = lines[i].match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!item) continue;
    const key = item[1].trim();
    const inlineValue = item[2].trim();

    if (inlineValue === "") {
      const listItems: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const listMatch = lines[j].match(/^\s*-\s+(.+)$/);
        if (!listMatch) break;
        listItems.push(listMatch[1].trim().replace(/^['"]|['"]$/g, ""));
        j++;
      }
      if (listItems.length > 0) {
        meta[key] = JSON.stringify(listItems);
        i = j - 1;
        continue;
      }
      meta[key] = "";
      continue;
    }

    meta[key] = inlineValue.replace(/^['"]|['"]$/g, "");
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

/** OpenClaw / Claude agent `tools` / `allowed-tools` → niuma internal tool ids. */
function normalizeToolId(raw: string): string {
  const name = raw.trim().replace(/^['"]|['"]$/g, "").split("(")[0]?.trim() ?? "";
  const lower = name.toLowerCase();
  if (lower === "glob") return "ls";
  if (lower === "edit") return "write";
  return lower;
}

function pickFrontmatter(frontmatter: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = frontmatter[key]?.trim();
    if (value) return value;
  }
  return undefined;
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
  const title = pickFrontmatter(frontmatter, "name") || extractTitle(content, withoutExt);
  const description = pickFrontmatter(frontmatter, "description") || extractDescription(content);
  const identity = buildIdentity(pickFrontmatter(frontmatter, "id"), entry.name, context);
  const temperature = Number(frontmatter.temperature);
  const maxTokens = Number(frontmatter.maxTokens ?? frontmatter.max_tokens);
  const toolRaw =
    pickFrontmatter(frontmatter, "tools", "allowed-tools", "enabledInternalTools") ?? "";
  const skillRaw = pickFrontmatter(frontmatter, "skills", "enabledSkillIds");

  return {
    id: identity.id,
    slug: identity.slug,
    schemaVersion: "v1",
    sourceType,
    sourcePath: entry.path,
    file: entry.name,
    name: title,
    role: pickFrontmatter(frontmatter, "role") || (context.teamId ? title : "Specialist"),
    avatar: pickFrontmatter(frontmatter, "emoji", "avatar") || "",
    description,
    providerId: pickFrontmatter(frontmatter, "providerId") || "",
    modelId: pickFrontmatter(frontmatter, "model", "modelId") || "",
    temperature: Number.isFinite(temperature) ? temperature : undefined,
    maxTokens: Number.isFinite(maxTokens) ? maxTokens : undefined,
    sandboxMode: pickFrontmatter(frontmatter, "sandbox", "sandboxMode") || undefined,
    enabledInternalTools: parseListField(toolRaw).map(normalizeToolId).filter(Boolean),
    enabledSkillIds:
      skillRaw !== undefined
        ? parseListField(skillRaw)
        : "enabledSkillIds" in frontmatter
          ? parseListField(frontmatter.enabledSkillIds)
          : undefined,
    enabledMcpServerIds: parseListField(frontmatter.enabledMcpServerIds),
    workspacePath: pickFrontmatter(frontmatter, "workspace", "workspacePath") || "",
    systemPrompt: content,
    fromTeams: !!context.teamId,
  };
}

// ─── Cache ───────────────────────────────────────────────────────────────────

let cache: CatalogAgent[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

export function invalidateAgentCatalogCache(): void {
  cache = null;
}

/** Parse one OpenClaw / Claude-style agent markdown file (for tests and tools). */
export function parseCatalogAgentMarkdown(
  file: string,
  raw: string,
  teamId?: string,
): CatalogAgent {
  return markdownToAgent({ name: file, path: file, isDir: false }, raw, { teamId });
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

  const rootDir = await invoke<string>("get_niuma_root_dir").catch(() => "");
  const teamAgents = await scanTeamAgentDirs(rootDir);

  const map = new Map<string, CatalogAgent>();
  for (const a of teamAgents) {
    map.set(a.id, a);
    map.set(`name:${a.name.toLowerCase()}`, a);
  }

  const dedup = new Map<string, CatalogAgent>();
  for (const item of map.values()) {
    dedup.set(item.id, item);
  }
  const merged = Array.from(dedup.values());
  // Assign avatars by stable hash of the agent slug so each agent always gets
  // the same icon from talent_icon, but the distribution looks random.
  // Team agents (fromTeams) always use talent_icon — overriding any emoji avatar
  // they may have set in their frontmatter.
  const sorted = [...merged].sort((a, b) => a.file.localeCompare(b.file));
  const talentLen = TALENT_AVATAR_ITEMS.length;
  sorted.forEach((agent) => {
    const needsIcon = agent.fromTeams ? true : !agent.avatar;
    if (needsIcon && talentLen > 0) {
      let h = 0;
      for (let i = 0; i < agent.slug.length; i++) {
        h = (Math.imul(31, h) + agent.slug.charCodeAt(i)) | 0;
      }
      agent.avatar = TALENT_AVATAR_ITEMS[Math.abs(h) % talentLen]?.avatarUrl ?? "🤖";
    }
  });
  cache = sorted;
  cacheTimestamp = now;
  return cache;
}
