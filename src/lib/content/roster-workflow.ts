/** Map team `roles` skills/commands onto the manuscript pipeline without hardcoded seat names. */

import type { TeamRoleDefinition } from "@/lib/agent/team-manifest";
import { resolveDefaultRole } from "@/lib/agent/team-manifest";

export type ContentCommandFamily = "draft" | "image" | "format" | "publish";

export type ContentWorkflowCommands = {
  draft: string[];
  image: string[];
  format: string[];
  publish: string[];
};

export type ContentRosterCopy = {
  hostName: string;
  specialistNames: string[];
  writerName?: string;
  imageName?: string;
  publisherName?: string;
  draftCommand: string;
  formatCommand: string;
  publishCommand: string;
  imageCommand: string;
};

function normCommand(name: string): string {
  return name.trim().toLowerCase().replace(/^\//, "");
}

export function skillFamily(slug: string): ContentCommandFamily | undefined {
  const value = slug.trim().toLowerCase();
  if (!value) return undefined;
  if (value === "article-main" || value.startsWith("article-main")) return "draft";
  if (value.includes("image")) return "image";
  if (value.includes("formatting")) return "format";
  if (value.includes("publish")) return "publish";
  return undefined;
}

function uniqueFamilies(role: TeamRoleDefinition): ContentCommandFamily[] {
  const families: ContentCommandFamily[] = [];
  for (const skill of role.skills) {
    const family = skillFamily(skill);
    if (family && !families.includes(family)) families.push(family);
  }
  return families;
}

export function resolveContentWorkflowCommands(
  roles: TeamRoleDefinition[],
  defaultCommand?: string,
): ContentWorkflowCommands {
  const out: ContentWorkflowCommands = { draft: [], image: [], format: [], publish: [] };
  for (const role of roles) {
    const families = uniqueFamilies(role);
    const commands = role.commands.map(normCommand).filter(Boolean);
    if (families.length === 0 || commands.length === 0) continue;
    if (families.length === 1) {
      out[families[0]].push(...commands);
      continue;
    }
    const unused = [...families];
    for (const command of commands) {
      const named = unused.find((family) => command.includes(family) || family.includes(command));
      if (named) {
        out[named].push(command);
        unused.splice(unused.indexOf(named), 1);
        continue;
      }
      const next = unused.shift() ?? families[families.length - 1];
      out[next].push(command);
    }
  }
  const fallback = defaultCommand ? normCommand(defaultCommand) : "";
  if (fallback && !out.draft.includes(fallback)) out.draft.unshift(fallback);
  return out;
}

export function hasFamilyCommand(
  commands: ContentWorkflowCommands | undefined,
  family: ContentCommandFamily,
  name: string,
): boolean {
  const needle = normCommand(name);
  if (!needle) return false;
  if (commands) return commands[family].includes(needle);
  if (family === "draft") {
    return (
      needle === "article" ||
      needle === "draft" ||
      needle === "continue" ||
      needle === "rewrite"
    );
  }
  return needle === family;
}

export function firstFamilyCommand(
  commands: ContentWorkflowCommands | undefined,
  family: ContentCommandFamily,
): string {
  return commands?.[family][0] ?? (family === "draft" ? "draft" : family);
}

export function imageRoleNames(roles: TeamRoleDefinition[]): string[] {
  const commands = resolveContentWorkflowCommands(roles);
  const image = new Set(commands.image);
  return roles
    .filter((role) => role.commands.some((name) => image.has(normCommand(name))))
    .map((role) => role.name.trim())
    .filter(Boolean);
}

export function resolveContentRosterCopy(
  roles: TeamRoleDefinition[],
  options?: { defaultAgent?: string; defaultCommand?: string },
): ContentRosterCopy {
  const commands = resolveContentWorkflowCommands(roles, options?.defaultCommand);
  const host = resolveDefaultRole({ defaultAgent: options?.defaultAgent, roles });
  const byFamily = (family: ContentCommandFamily) =>
    roles.find((role) => uniqueFamilies(role).includes(family))?.name.trim();
  return {
    hostName: host?.name.trim() ?? "",
    specialistNames: roles
      .filter((role) => role.agentFile !== host?.agentFile)
      .map((role) => role.name.trim())
      .filter(Boolean),
    writerName: roles.find((role) => role.skills.some((slug) => slug.includes("writing")))?.name.trim(),
    imageName: byFamily("image"),
    publisherName: byFamily("publish") ?? byFamily("format"),
    draftCommand: firstFamilyCommand(commands, "draft"),
    formatCommand: firstFamilyCommand(commands, "format"),
    publishCommand: firstFamilyCommand(commands, "publish"),
    imageCommand: firstFamilyCommand(commands, "image"),
  };
}

export function teamPackPath(teamId: string, rest: string): string {
  const id = teamId.trim() || "content";
  return `.teams/${id}/${rest.replace(/^\/+/, "")}`;
}

export function editorialConfigRel(teamId: string): string {
  return teamPackPath(teamId, "editor/editorial.yaml");
}

export function articleBlockPresetDir(teamId: string): string {
  return teamPackPath(teamId, "editor/blocks");
}

export function formatThemeUserDir(teamId: string): string {
  return teamPackPath(teamId, "editor/themes/custom");
}

export function formatThemeBuiltinDir(_teamId: string, _formattingSkill?: string): string {
  const teamId = _teamId.trim() || "content";
  return teamPackPath(teamId, "editor/themes/builtin");
}

export function firstFormattingSkill(roles: TeamRoleDefinition[]): string | undefined {
  return roles.flatMap((role) => role.skills).find((slug) => skillFamily(slug) === "format");
}

export function topicNotConfirmedMessage(copy?: Partial<ContentRosterCopy>): string {
  const command = (copy?.draftCommand ?? "draft").replace(/^\//, "");
  const host = copy?.hostName?.trim();
  const who = host ? `可请${host}` : "";
  return `尚未开稿。请在聊天里用 /${command} <主题> 创建目录，或 ${who} 从 journal 开稿后再编辑。`.replace(
    /\s+/g,
    " ",
  );
}
