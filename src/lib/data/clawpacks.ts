/**
 * Clawpack agent catalog — preset agents bundled with niuma-app.
 * Source files live in <root>/clawpacks/agents/*.json.
 */
import { invoke } from "@tauri-apps/api/core";
import { TALENT_AVATAR_ITEMS } from "../talent-avatar";

export interface ClawpackAgent {
  /** File name without path, e.g. "alice.json" */
  file: string;
  name: string;
  role: string;
  avatar: string;
  description: string;
  systemPrompt: string;
  providerId: string;
  modelId: string;
  enabledInternalTools: string[];
  enabledSkillIds: string[];
  enabledMcpServerIds: string[];
  sandboxMode: string;
  temperature: number;
  maxTokens: number;
  workspacePath: string;
}

/** Re-export TalentAvatarItem and TALENT_AVATAR_ITEMS for convenience. */
export { TALENT_AVATAR_ITEMS };

/**
 * Fetch the full catalog of preset agents from /clawpacks/agents/index.json
 * and then load each individual agent JSON.
 * Avatars are assigned from TALENT_AVATAR_ITEMS by index (not stored in the JSON files).
 */
export async function fetchClawpackCatalog(): Promise<ClawpackAgent[]> {
  const indexRes = await fetch("/clawpacks/agents/index.json");
  const files: string[] = await indexRes.json();

  const agents = await Promise.all(
    files.map(async (file, i) => {
      const res = await fetch(`/clawpacks/agents/${file}`);
      const data = await res.json();
      const avatar = TALENT_AVATAR_ITEMS[i % TALENT_AVATAR_ITEMS.length]?.avatarUrl ?? '';
      return { file, avatar, ...data } as ClawpackAgent;
    })
  );
  return agents;
}

// ─── Skill catalog ────────────────────────────────────────────────────────────

/**
 * A preset skill bundled with niuma-app.
 * Source files live in <root>/clawpacks/skills/<slug>/SKILL.md.
 */
export interface ClawpackSkill {
  /** Directory name, e.g. "gt-translate" */
  slug: string;
  /** Parsed from SKILL.md frontmatter */
  name: string;
  description: string;
  icon: string;
  category: string;
  command: string;
  enabled: boolean;
  isPreset: boolean;
  toolsMode: string;
  parameters: { name: string; description: string; required: boolean; type: string; defaultValue?: string }[];
  /** Raw SKILL.md content (frontmatter + body) */
  raw: string;
}

function parseSkillFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const val = m[2].trim();
    try { meta[m[1]] = JSON.parse(val); } catch { meta[m[1]] = val.replace(/^['"]|['"]$/g, ""); }
  }
  return meta;
}

function parseParameters(value: string | undefined): ClawpackSkill["parameters"] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function rawToSkill(slug: string, raw: string): ClawpackSkill {
  const meta = parseSkillFrontmatter(raw);
  return {
    slug,
    name: meta.name || slug,
    description: meta.description || "",
    icon: meta.icon || "⚡",
    category: meta.category || "",
    command: meta.command || slug,
    enabled: meta.enabled !== "false",
    isPreset: true,
    toolsMode: meta.toolsMode || "none",
    parameters: parseParameters(meta.parameters),
    raw,
  };
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

interface DirEntry { name: string; path: string; isDir: boolean }

/**
 * Fetch the skill catalog.
 * - In Tauri: scans the clawpacks/skills directory directly (picks up runtime installs too)
 * - In browser: reads /clawpacks/skills/index.json + fetches each SKILL.md via HTTP
 */
export async function fetchClawpackSkillCatalog(): Promise<ClawpackSkill[]> {
  if (isTauri()) {
    try {
      const dir = await invoke<string>("get_clawpacks_skills_dir");
      if (!dir) throw new Error("no dir");
      const entries = await invoke<DirEntry[]>("list_directory", { path: dir });
      const results = await Promise.allSettled(
        entries
          .filter((e) => e.isDir)
          .map(async (e) => {
            const sep = e.path.includes("/") ? "/" : "\\";
            const raw = await invoke<string>("read_text_file", {
              path: `${e.path}${sep}SKILL.md`,
            });
            return rawToSkill(e.name, raw);
          })
      );
      return results
        .filter((r): r is PromiseFulfilledResult<ClawpackSkill> => r.status === "fulfilled")
        .map((r) => r.value)
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      console.warn("[clawpacks] Tauri scan failed, falling back to HTTP", err);
    }
  }

  // Browser / fallback: HTTP fetch via index.json
  const indexRes = await fetch("/clawpacks/skills/index.json");
  const slugs: string[] = await indexRes.json();
  const skills = await Promise.allSettled(
    slugs.map(async (slug) => {
      const res = await fetch(`/clawpacks/skills/${slug}/SKILL.md`);
      if (!res.ok) throw new Error(`${slug}: ${res.status}`);
      return rawToSkill(slug, await res.text());
    })
  );
  return skills
    .filter((r): r is PromiseFulfilledResult<ClawpackSkill> => r.status === "fulfilled")
    .map((r) => r.value);
}

/**
 * Install an online skill SKILL.md to clawpacks/skills/<slug>/SKILL.md on disk.
 * Only works in Tauri context. Returns the installed ClawpackSkill on success.
 */
export async function installSkillToClawpacks(slug: string, raw: string): Promise<ClawpackSkill> {
  const dir = await invoke<string>("get_clawpacks_skills_dir");
  if (!dir) throw new Error("Cannot resolve clawpacks/skills directory");
  const sep = dir.includes("/") ? "/" : "\\";
  await invoke("write_text_file", { path: `${dir}${sep}${slug}${sep}SKILL.md`, content: raw });
  return rawToSkill(slug, raw);
}
