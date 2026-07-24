import { invoke } from "@tauri-apps/api/core";

export interface NiumaSkill {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  command: string;
  enabled: boolean;
  isPreset: boolean;
  toolsMode: string;
  parameters: { name: string; description: string; required: boolean; type: string; defaultValue?: string }[];
  raw: string;
}

interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

function parseSkillFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const item = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!item) continue;
    const value = item[2].trim();
    try {
      meta[item[1]] = JSON.parse(value);
    } catch {
      meta[item[1]] = value.replace(/^['"]|['"]$/g, "");
    }
  }
  return meta;
}

function parseParameters(value: string | undefined): NiumaSkill["parameters"] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rawToSkill(slug: string, raw: string): NiumaSkill {
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

export async function fetchNiumaSkillCatalog(): Promise<NiumaSkill[]> {
  if (!isTauri()) return [];

  const dir = await invoke<string>("get_niuma_skills_dir");
  if (!dir) return [];

  const entries = await invoke<DirEntry[]>("list_directory", { path: dir });
  const results = await Promise.allSettled(
    entries
      .filter((entry) => entry.isDir)
      .map(async (entry) => {
        const separator = entry.path.includes("/") ? "/" : "\\";
        const raw = await invoke<string>("read_text_file", {
          path: `${entry.path}${separator}SKILL.md`,
        });
        return rawToSkill(entry.name, raw);
      })
  );

  return results
    .filter((result): result is PromiseFulfilledResult<NiumaSkill> => result.status === "fulfilled")
    .map((result) => result.value)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function installSkillToNiuma(slug: string, raw: string): Promise<NiumaSkill> {
  const dir = await invoke<string>("get_niuma_skills_dir");
  if (!dir) throw new Error("Cannot resolve .niuma/skills directory");
  const separator = dir.includes("/") ? "/" : "\\";
  await invoke("write_text_file", {
    path: `${dir}${separator}${slug}${separator}SKILL.md`,
    content: raw,
  });
  return rawToSkill(slug, raw);
}
