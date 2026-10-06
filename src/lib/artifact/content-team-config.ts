/**
 * Team roster lives at `.niuma/teams/<id>/config.yaml`.
 * UI / workflow chrome lives at `.niuma/teams/<id>/presets/team.yaml`.
 * Content editorial voice lives at `.niuma/teams/<id>/presets/editorial.yaml`.
 */

import { invoke } from "@tauri-apps/api/core";
import { editorialConfigRel } from "@/lib/content/roster-workflow";

export const CONTENT_TEAM_CONFIG_REL = editorialConfigRel("content");

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
  channelName?: string;
  agentFiles: string[];
  defaultHired: string[];
  skillSlugs: string[];
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
    channelName: meta.channelName,
    agentFiles: parseYamlBlockList(raw, "agentFiles"),
    defaultHired: parseYamlBlockList(raw, "defaultHired"),
    skillSlugs: parseYamlBlockList(raw, "skillSlugs"),
    starterPrompts: parseYamlBlockList(raw, "starterPrompts"),
  };
}

export function formatContentTeamConfigContext(raw: string, teamId?: string): string {
  const id = teamId?.trim() || "content";
  const text = raw.trim();
  const editorial = editorialConfigRel(id);
  return [
    "[内容团队配置]",
    `path: ${editorial}`,
    "",
    "规则：",
    `- 账号、文风、审稿规则在 \`${editorial}\`。不要读 \`.aws-article/config.yaml\`，不要读 \`aws.env\` 里的 WRITING_MODEL / IMAGE_MODEL。`,
    `- 人员/技能/命令名录在 \`.niuma/teams/${id}/config.yaml\`。`,
    "- 不要创建 `.niuma-article/` 或新的 drafts 目录。审稿写当前稿同目录的 `review.md`。",
    "- 本篇标题/作者/摘要只改 `.niuma/artifacts/drafts/<YYYYMMDD-主题>/article.yaml`。",
    "- 写稿/配图走设置 → API 提供商。",
    "",
    text || "(配置文件为空)",
  ].join("\n");
}

export async function loadContentTeamConfigRaw(teamId?: string): Promise<string> {
  const id = teamId?.trim() || "content";
  const root = await invoke<string>("get_niuma_root_dir").catch(() => "");
  if (!root) return "";
  const path = `${root.replace(/\\/g, "/")}/${editorialConfigRel(id)}`;
  return invoke<string>("read_text_file", { path }).catch(() => "");
}
