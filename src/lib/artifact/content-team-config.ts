/**
 * Team roster lives at `.niuma/teams/<id>/config.yaml` (replaces TEAM.md).
 * The content team file also holds editorial fields that used to live in
 * `.aws-article/config.yaml`.
 */

import { invoke } from "@tauri-apps/api/core";

export const CONTENT_TEAM_CONFIG_REL = ".niuma/teams/content/config.yaml";

export interface ContentTeamManifest {
  id?: string;
  name?: string;
  description?: string;
  eyebrow?: string;
  avatar?: string;
  accent?: string;
  kind?: string;
  commandDir?: string;
  defaultCommand?: string;
  defaultAgent?: string;
  dataDomain?: string;
  surface?: string;
  agentFiles: string[];
  skillSlugs: string[];
  legacyNames: string[];
  legacyAgentFiles: string[];
  starterPrompts: string[];
}

export function parseYamlBlockList(raw: string, key: string): string[] {
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^${key}:\\s*(?:#.*)?$`).test(line));
  if (start < 0) return [];
  const items: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) break;
    if (trimmed.startsWith("#")) continue;
    const item = line.match(/^[ \t]+-[ \t]+(.+?)[ \t]*$/)?.[1]?.trim();
    if (!item) break;
    items.push(item.replace(/^['"]|['"]$/g, "").replace(/`/g, ""));
  }
  return items;
}

export function parseYamlScalars(raw: string): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const item = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!item) continue;
    const value = item[2].trim();
    if (!value || value === "|" || value === ">") continue;
    meta[item[1]] = value.replace(/^['"]|['"]$/g, "");
  }
  return meta;
}

export function parseContentTeamManifest(raw: string): ContentTeamManifest {
  const meta = parseYamlScalars(raw);
  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    eyebrow: meta.eyebrow,
    avatar: meta.avatar,
    accent: meta.accent,
    kind: meta.kind,
    commandDir: meta.commandDir,
    defaultCommand: meta.defaultCommand,
    defaultAgent: meta.defaultAgent,
    dataDomain: meta.dataDomain,
    surface: meta.surface,
    agentFiles: parseYamlBlockList(raw, "agentFiles"),
    skillSlugs: parseYamlBlockList(raw, "skillSlugs"),
    legacyNames: parseYamlBlockList(raw, "legacyNames"),
    legacyAgentFiles: parseYamlBlockList(raw, "legacyAgentFiles"),
    starterPrompts: parseYamlBlockList(raw, "starterPrompts"),
  };
}

export function formatContentTeamConfigContext(raw: string): string {
  const text = raw.trim();
  return [
    "[内容团队配置]",
    `path: ${CONTENT_TEAM_CONFIG_REL}`,
    "",
    "规则：",
    "- 这是编辑部唯一配置。不要读 `.aws-article/config.yaml`，不要读 `aws.env` 里的 WRITING_MODEL / IMAGE_MODEL。",
    "- 不要创建 `.niuma-article/` 或新的 drafts 目录。审稿写当前稿同目录的 `review.md`。",
    "- 本篇标题/作者/摘要只改 `.artifacts/drafts/<YYYYMMDD-主题>/article.yaml`。",
    "- 写稿/配图走设置 → API 提供商。",
    "",
    text || "(配置文件为空)",
  ].join("\n");
}

export async function loadContentTeamConfigRaw(): Promise<string> {
  const root = await invoke<string>("get_niuma_root_dir").catch(() => "");
  if (!root) return "";
  const path = `${root.replace(/\\/g, "/")}/${CONTENT_TEAM_CONFIG_REL}`;
  return invoke<string>("read_text_file", { path }).catch(() => "");
}
