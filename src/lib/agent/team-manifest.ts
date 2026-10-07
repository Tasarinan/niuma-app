import {
  parseContentTeamManifest,
  parseYamlScalars,
  type ContentTeamManifest,
} from "@/lib/artifact/content-team-config";

export type TeamRoleDefinition = {
  agentFile: string;
  name: string;
  skills: string[];
  commands: string[];
  summary: string;
};

export type TeamPackManifest = ContentTeamManifest & {
  workflow?: string;
  workspaceRoot?: boolean;
  workbench?: boolean;
  /** Predefined channel UI from team.yaml `view`: chat | editor | meeting | health. */
  view?: string;
  roles: TeamRoleDefinition[];
};

function normalizeRoleFile(value: string): string {
  return value.endsWith(".md") ? value : `${value}.md`;
}

/** Parse `roles:` list items with agentFile, name, skills, commands, summary. */
export function parseTeamRoles(raw: string): TeamRoleDefinition[] {
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => /^roles:\s*(?:#.*)?$/.test(line.trim()));
  if (start < 0) return [];

  const roles: TeamRoleDefinition[] = [];
  let i = start + 1;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (/^[A-Za-z_][A-Za-z0-9_-]*:\s*/.test(trimmed) && !trimmed.startsWith("- ")) break;

    const agentMatch = line.match(/^\s*-\s+agentFile:\s*(.+?)\s*$/);
    if (!agentMatch) {
      i++;
      continue;
    }

    const role: TeamRoleDefinition = {
      agentFile: normalizeRoleFile(agentMatch[1].replace(/^['"]|['"]$/g, "")),
      name: "",
      skills: [],
      commands: [],
      summary: "",
    };
    i++;

    while (i < lines.length) {
      const inner = lines[i];
      const innerTrim = inner.trim();
      if (/^\s*-\s+agentFile:/.test(inner)) break;
      if (/^[A-Za-z_][A-Za-z0-9_-]*:\s*/.test(innerTrim) && !/^\s+/.test(inner)) break;

      const nameMatch = inner.match(/^\s+name:\s*(.+?)\s*$/);
      const summaryMatch = inner.match(/^\s+summary:\s*(.+?)\s*$/);
      const skillsStart = inner.match(/^\s+skills:\s*$/);
      const commandsStart = inner.match(/^\s+commands:\s*$/);

      if (nameMatch) role.name = nameMatch[1].replace(/^['"]|['"]$/g, "");
      else if (summaryMatch) role.summary = summaryMatch[1].replace(/^['"]|['"]$/g, "");
      else if (skillsStart) {
        i++;
        while (i < lines.length) {
          const skillLine = lines[i];
          if (/^\s*-\s+agentFile:/.test(skillLine)) break;
          const skillItem = skillLine.match(/^\s+-\s+(.+?)\s*$/);
          if (!skillItem) break;
          role.skills.push(skillItem[1].replace(/^['"]|['"]$/g, ""));
          i++;
        }
        continue;
      } else if (commandsStart) {
        i++;
        while (i < lines.length) {
          const cmdLine = lines[i];
          if (/^\s*-\s+agentFile:/.test(cmdLine)) break;
          const cmdItem = cmdLine.match(/^\s+-\s+(.+?)\s*$/);
          if (!cmdItem) break;
          role.commands.push(cmdItem[1].replace(/^['"]|['"]$/g, ""));
          i++;
        }
        continue;
      }
      i++;
    }

    if (role.agentFile) roles.push(role);
  }

  return roles;
}

export function normalizeAgentFileName(file: string): string {
  const base = file.trim().replace(/\\/g, "/").split("/").pop() ?? file.trim();
  return base.toLowerCase().endsWith(".md") ? base : `${base}.md`;
}

export function findRoleByAgentFile(
  roles: TeamRoleDefinition[],
  file: string,
): TeamRoleDefinition | undefined {
  const needle = normalizeAgentFileName(file);
  return roles.find((role) => normalizeAgentFileName(role.agentFile) === needle);
}

export function findRoleByCommand(
  roles: TeamRoleDefinition[],
  command: string,
): TeamRoleDefinition | undefined {
  const needle = command.trim().toLowerCase().replace(/^\//, "");
  if (!needle) return undefined;
  return roles.find((role) =>
    role.commands.some((name) => name.trim().toLowerCase() === needle),
  );
}

export function resolveDefaultRole(options: {
  defaultAgent?: string;
  roles?: TeamRoleDefinition[];
  agentFiles?: string[];
}): TeamRoleDefinition | undefined {
  const roles = options.roles ?? [];
  const key = options.defaultAgent?.trim();
  if (key) {
    const byFile = findRoleByAgentFile(roles, key);
    if (byFile) return byFile;
    const byName = roles.find((role) => role.name === key);
    if (byName) return byName;
  }
  const firstFile = options.agentFiles?.[0];
  if (firstFile) {
    const byFirst = findRoleByAgentFile(roles, firstFile);
    if (byFirst) return byFirst;
  }
  return roles[0];
}

export function agentMatchesRole(
  agent: { name: string; role?: string },
  role: TeamRoleDefinition | undefined,
): boolean {
  if (!role) return false;
  const fields = [agent.name, agent.role ?? ""].map((value) => value.trim()).filter(Boolean);
  return fields.some((field) => field === role.name || field.includes(role.name));
}

export function parseTeamPackManifest(raw: string): TeamPackManifest {
  const base = parseContentTeamManifest(raw);
  const meta = parseYamlScalars(raw);
  const workflow = meta.workflow?.trim();
  const workspaceRoot = meta.workspaceRoot === "true";
  const workbench = meta.workbench !== "false" && meta.surface !== "catalog";

  return {
    ...base,
    workflow,
    workspaceRoot,
    workbench,
    view: meta.view?.trim(),
    roles: parseTeamRoles(raw),
  };
}

export function isCatalogTeamPack(manifest: TeamPackManifest): boolean {
  return manifest.surface === "catalog" || manifest.workbench === false;
}

export function listDefaultHiredFromManifest(manifest: TeamPackManifest): string[] {
  const hired = manifest.defaultHired.map((file) => normalizeAgentFileName(file));
  if (hired.length > 0) return [...new Set(hired)];
  if (manifest.defaultAgent?.trim()) return [normalizeAgentFileName(manifest.defaultAgent)];
  return [];
}

export function manifestToCommandDir(manifest: TeamPackManifest): string | undefined {
  if (manifest.commandDir) return manifest.commandDir;
  if (manifest.id) return `teams/${manifest.id}/commands`;
  return undefined;
}

export function listSkillSlugsFromManifest(manifest: TeamPackManifest): string[] {
  if (manifest.skillSlugs.length > 0) return manifest.skillSlugs;
  const fromRoles = manifest.roles.flatMap((role) => role.skills);
  return [...new Set(fromRoles)];
}

export function listAgentFilesFromManifest(manifest: TeamPackManifest): string[] {
  if (manifest.agentFiles.length > 0) {
    return manifest.agentFiles.map((file) => (file.endsWith(".md") ? file : `${file}.md`));
  }
  return manifest.roles.map((role) => role.agentFile);
}

export function listDefaultCommandFromManifest(manifest: TeamPackManifest): string | undefined {
  const explicit = manifest.defaultCommand?.trim();
  if (explicit) return explicit.replace(/^\//, "");
  const role = resolveDefaultRole({
    defaultAgent: manifest.defaultAgent,
    roles: manifest.roles,
    agentFiles: listAgentFilesFromManifest(manifest),
  });
  const command = role?.commands[0]?.trim();
  return command ? command.replace(/^\//, "") : undefined;
}

/** @deprecated Single `team.yaml` replaces config + presets merge. */
export function mergeTeamPackManifest(roster: TeamPackManifest, extra?: TeamPackManifest): TeamPackManifest {
  if (!extra) return roster;
  return { ...roster, ...extra, roles: roster.roles.length ? roster.roles : extra.roles };
}
