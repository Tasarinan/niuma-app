import type { CatalogAgent } from "@/lib/data/agent-loader";
import { parseCatalogAgentMarkdown } from "@/lib/data/agent-loader";
import type { TeamRoleDefinition } from "./team-manifest";
import { normalizeAgentFileName } from "./team-manifest";

export function catalogAgentToTeamRole(agent: CatalogAgent): TeamRoleDefinition {
  return {
    agentFile: agent.file.endsWith(".md") ? agent.file : `${agent.file}.md`,
    name: agent.name.trim(),
    skills: agent.enabledSkillIds ?? [],
    commands: agent.commands ?? [],
    summary: agent.description.trim(),
  };
}

export function teamRolesFromAgentMarkdown(
  files: Array<{ file: string; raw: string }>,
  teamId: string,
): TeamRoleDefinition[] {
  const roles: TeamRoleDefinition[] = [];
  for (const entry of files) {
    if (!entry.file.endsWith(".md") || entry.file.startsWith("_")) continue;
    const agent = parseCatalogAgentMarkdown(entry.file, entry.raw, teamId);
    roles.push(catalogAgentToTeamRole(agent));
  }
  roles.sort((a, b) => a.agentFile.localeCompare(b.agentFile));
  return roles;
}

export function sortRolesWithDefaultFirst(
  roles: TeamRoleDefinition[],
  defaultAgent?: string,
): TeamRoleDefinition[] {
  const key = defaultAgent?.trim();
  if (!key) return roles;
  const needle = normalizeAgentFileName(key);
  const idx = roles.findIndex((role) => normalizeAgentFileName(role.agentFile) === needle);
  if (idx <= 0) return roles;
  const next = [...roles];
  const [first] = next.splice(idx, 1);
  next.unshift(first);
  return next;
}
