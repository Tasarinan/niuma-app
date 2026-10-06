import { agentDefinitionRepo, type CreateInput, type UpdateInput } from "@/lib/data";
import { invoke } from "@tauri-apps/api/core";
import { loadAgentCatalog, invalidateAgentCatalogCache, type CatalogAgent } from "@/lib/data/agent-loader";
import { loadChannels } from "@/lib/storage/group-chat.storage";
import { loadHiredAgentFiles, saveHiredAgentFiles, setDefaultHiredAgentFiles } from "@/lib/storage";
import { useSkillStore } from "@/store";
import type { AgentDefinition, AgentInternalToolId, GroupChannel } from "@/types";
import { bridgeEnabledNiumaSkills } from "./skill-bridge";
import { catalogAgentAliases } from "./command-target";
import { canonicalNiumaSkillSlug } from "./skill-slugs";
import { resolvePresetSkillIds } from "./preset-skill-ids";
import { discoverCatalogTeamPresets, discoverWorkbenchTeamPresets, getTeamPackByChannel } from "./team-discovery";
import { findRoleByAgentFile, type TeamRoleDefinition } from "./team-manifest";

export type WorkbenchTeamId = string;
export type WorkbenchTeamAccent = "rose" | "emerald" | "sky" | "violet" | "amber";

export interface WorkbenchTeamPreset {
  id: WorkbenchTeamId;
  name: string;
  eyebrow: string;
  description: string;
  avatar: string;
  accent: WorkbenchTeamAccent;
  /** Derived from the bound team. Not a user-facing channel type. */
  kind: GroupChannel["kind"];
  commandDir?: string;
  agentFiles: string[];
  skillSlugs: string[];
  starterPrompts: string[];
  /** Declared in presets/team.yaml — picks a predefined channel UI. */
  view?: string;
  workflow?: string;
  workspaceRoot?: boolean;
  roles?: TeamRoleDefinition[];
  defaultAgent?: string;
  defaultCommand?: string;
  dataDomain?: string;
  channelName?: string;
  defaultHired?: string[];
}

/** @deprecated Built-in teams load from `.niuma/teams/<id>/config.yaml`. */
export const WORKBENCH_TEAM_PRESETS: WorkbenchTeamPreset[] = [];

export function getWorkbenchTeamPreset(
  channel: GroupChannel | null | undefined,
  presets: WorkbenchTeamPreset[] = WORKBENCH_TEAM_PRESETS,
) {
  if (!channel) return null;
  return getTeamPackByChannel(channel, presets);
}

export function getWorkbenchTeamPresetById(
  id: WorkbenchTeamId,
  presets: WorkbenchTeamPreset[] = WORKBENCH_TEAM_PRESETS,
) {
  return presets.find((preset) => preset.id === id) ?? null;
}

export async function loadWorkbenchTeamPresets(): Promise<WorkbenchTeamPreset[]> {
  if (!isTauri()) return WORKBENCH_TEAM_PRESETS;
  return discoverWorkbenchTeamPresets();
}

async function loadPresetForTeam(teamId: WorkbenchTeamId): Promise<WorkbenchTeamPreset | null> {
  const presets = await loadWorkbenchTeamPresets();
  return presets.find((preset) => preset.id === teamId) ?? null;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function syncWorkbenchTeamChannel(
  preset: WorkbenchTeamPreset,
  options: {
    channel?: GroupChannel | null;
    createAgent: (input: CreateInput<AgentDefinition>) => Promise<AgentDefinition>;
    updateAgent: (id: string, patch: UpdateInput<AgentDefinition>) => Promise<AgentDefinition | null>;
    editChannel?: (
      id: string,
      patch: Partial<Pick<GroupChannel, "name" | "avatar" | "agentIds" | "kind" | "tags">>,
    ) => void;
    refreshAgents: () => Promise<void>;
  },
): Promise<AgentDefinition[]> {
  if (typeof window === "undefined") return [];

  invalidateAgentCatalogCache();
  const catalog = await loadAgentCatalog();
  if (catalog.length === 0) return [];

  await bridgeEnabledNiumaSkills().catch(() => []);
  const skillsBySlug = getNiumaSkillIdsBySlug();

  const hiredFiles = loadHiredAgentFiles();
  for (const file of preset.agentFiles) hiredFiles.add(file);
  saveHiredAgentFiles(hiredFiles);

  let repoAgents = await agentDefinitionRepo.list();
  const updateRepoAgent = (agent: AgentDefinition) => {
    repoAgents = [agent, ...repoAgents.filter((item) => item.id !== agent.id)];
  };

  const members = await Promise.all(
    preset.agentFiles.map((file) =>
      ensurePresetAgent(preset.id, file, preset.skillSlugs, catalog, repoAgents, skillsBySlug, options.createAgent, options.updateAgent, updateRepoAgent, preset.roles),
    ),
  );
  const agents = members.filter((agent): agent is AgentDefinition => Boolean(agent));
  const agentIds = agents.map((agent) => agent.id);

  if (options.channel && options.editChannel && agentIds.length > 0) {
    const patch: Partial<Pick<GroupChannel, "name" | "avatar" | "agentIds" | "kind" | "tags">> = {};
    if (options.channel.avatar !== preset.avatar) patch.avatar = preset.avatar;
    if ((options.channel.kind ?? "chat") !== preset.kind) patch.kind = preset.kind;
    // When all preset agents are confirmed present, replace channel members with the
    // preset's agents. If not all agents are ready yet, fall back to additive merge.
    const allNewAgentsReady = agentIds.length >= preset.agentFiles.length;
    const targetAgentIds = allNewAgentsReady
      ? agentIds
      : unique([...options.channel.agentIds, ...agentIds]);
    if (!sameStringArray(options.channel.agentIds, targetAgentIds)) patch.agentIds = targetAgentIds;
    if (Object.keys(patch).length > 0) options.editChannel(options.channel.id, patch);
  }

  await options.refreshAgents();
  return agents;
}

function getNiumaSkillIdsBySlug() {
  const map = new Map<string, string>();
  for (const skill of useSkillStore.getState().items) {
    if (skill.sourceType !== "niuma" || !skill.source) continue;
    map.set(canonicalNiumaSkillSlug(skill.source), skill.id);
  }
  return map;
}

async function ensurePresetAgent(
  teamId: WorkbenchTeamId,
  file: string,
  skillSlugs: string[],
  catalog: CatalogAgent[],
  repoAgents: AgentDefinition[],
  skillsBySlug: Map<string, string>,
  createAgent: (input: CreateInput<AgentDefinition>) => Promise<AgentDefinition>,
  updateAgent: (id: string, patch: UpdateInput<AgentDefinition>) => Promise<AgentDefinition | null>,
  updateRepoAgent: (agent: AgentDefinition) => void,
  roles: TeamRoleDefinition[] = [],
) {
  const teamAgentPath = `/.niuma/teams/${teamId}/agents/${file}`.replace(/\\/g, "/");
  const catalogAgent = catalog.find((agent) => agent.file === file && agent.sourcePath.replace(/\\/g, "/").endsWith(teamAgentPath))
    ?? catalog.find((agent) => agent.file === file);
  if (!catalogAgent) return null;

  const role = findRoleByAgentFile(roles, file);
  const targetSkillIds = resolvePresetSkillIds(
    catalogAgent.enabledSkillIds,
    skillSlugs,
    skillsBySlug,
    role?.skills,
  );
  const preset = await loadPresetForTeam(teamId);
  const workspacePath =
    preset?.workspaceRoot
      ? (await invoke<string>("get_niuma_root_dir").catch(() => "")) || catalogAgent.workspacePath || ""
      : catalogAgent.workspacePath || "";
  const existing = findAgentByCatalog(repoAgents, catalogAgent, roles);

  if (!existing) {
    const created = await createAgent({
      name: catalogAgent.name,
      role: catalogAgent.role ?? "",
      avatar: catalogAgent.avatar ?? "",
      description: catalogAgent.description ?? "",
      systemPrompt: catalogAgent.systemPrompt ?? "",
      providerId: catalogAgent.providerId ?? "",
      modelId: catalogAgent.modelId ?? "",
      enabledInternalTools: (catalogAgent.enabledInternalTools ?? []) as AgentInternalToolId[],
      enabledSkillIds: targetSkillIds,
      enabledMcpServerIds: catalogAgent.enabledMcpServerIds ?? [],
      sandboxMode: (catalogAgent.sandboxMode ?? "read-only") as AgentDefinition["sandboxMode"],
      temperature: catalogAgent.temperature ?? 0.7,
      maxTokens: catalogAgent.maxTokens ?? 2000,
      workspacePath,
    });
    updateRepoAgent(created);
    return created;
  }

  // Sync avatar: if the catalog resolved a talent_icon image but the stored
  // agent still carries an emoji or blank avatar, update it.
  const catalogAvatar = catalogAgent.avatar ?? "";
  const existingAvatar = existing.avatar ?? "";
  const catalogIsImage = catalogAvatar.startsWith("/") || catalogAvatar.startsWith("http") || catalogAvatar.startsWith("data:");
  const existingIsImage = existingAvatar.startsWith("/") || existingAvatar.startsWith("http") || existingAvatar.startsWith("data:");
  const needsAvatarSync = catalogAgent.fromTeams && catalogIsImage && !existingIsImage;

  const patch: UpdateInput<AgentDefinition> = {};
  if (!sameStringArray(existing.enabledSkillIds ?? [], targetSkillIds)) patch.enabledSkillIds = targetSkillIds;
  if (needsAvatarSync) patch.avatar = catalogAvatar;
  if (existing.name !== catalogAgent.name) patch.name = catalogAgent.name;
  if ((existing.role ?? "") !== (catalogAgent.role ?? "")) patch.role = catalogAgent.role ?? "";
  if (existing.description !== (catalogAgent.description ?? "")) patch.description = catalogAgent.description ?? "";
  if ((existing.systemPrompt ?? "") !== (catalogAgent.systemPrompt ?? "")) {
    patch.systemPrompt = catalogAgent.systemPrompt ?? "";
  }
  if (workspacePath && existing.workspacePath !== workspacePath) patch.workspacePath = workspacePath;
  if (
    !sameStringArray(
      existing.enabledInternalTools ?? [],
      (catalogAgent.enabledInternalTools ?? []) as AgentInternalToolId[],
    )
  ) {
    patch.enabledInternalTools = (catalogAgent.enabledInternalTools ?? []) as AgentInternalToolId[];
  }
  if (existing.sandboxMode !== (catalogAgent.sandboxMode ?? existing.sandboxMode)) {
    patch.sandboxMode = (catalogAgent.sandboxMode ?? existing.sandboxMode) as AgentDefinition["sandboxMode"];
  }

  if (Object.keys(patch).length > 0) {
    const updated = await updateAgent(existing.id, patch);
    if (updated) {
      updateRepoAgent(updated);
      return updated;
    }
  }
  return existing;
}

function sameStringArray(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export async function ensureWorkbenchDefaultTeams(options: {
  createAgent: (input: CreateInput<AgentDefinition>) => Promise<AgentDefinition>;
  updateAgent: (id: string, patch: UpdateInput<AgentDefinition>) => Promise<AgentDefinition | null>;
  refreshAgents: () => Promise<void>;
  createChannel: (
    name: string,
    agentIds: string[],
    avatar?: string,
    kind?: GroupChannel["kind"],
    tags?: string[],
    teamId?: string,
  ) => GroupChannel;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const presets = await loadWorkbenchTeamPresets();
  const catalogPresets = await discoverCatalogTeamPresets();
  const catalog = await loadAgentCatalog();
  if (catalog.length === 0) return false;

  await bridgeEnabledNiumaSkills().catch(() => []);
  const skillsBySlug = getNiumaSkillIdsBySlug();

  const catalogDefaultHired = catalogPresets.flatMap((preset) => preset.defaultHired ?? []);
  setDefaultHiredAgentFiles(catalogDefaultHired);

  const hiredFiles = loadHiredAgentFiles();
  for (const file of catalogDefaultHired) hiredFiles.add(file);
  for (const preset of presets) {
    for (const file of preset.agentFiles) hiredFiles.add(file);
  }
  saveHiredAgentFiles(hiredFiles);

  let repoAgents = await agentDefinitionRepo.list();
  const updateRepoAgent = (agent: AgentDefinition) => {
    repoAgents = [agent, ...repoAgents.filter((item) => item.id !== agent.id)];
  };

  for (const preset of catalogPresets) {
    for (const file of preset.defaultHired ?? []) {
      await ensurePresetAgent(
        preset.id,
        file,
        preset.skillSlugs,
        catalog,
        repoAgents,
        skillsBySlug,
        options.createAgent,
        options.updateAgent,
        updateRepoAgent,
        preset.roles,
      );
    }
  }

  const existingChannels = loadChannels();
  // Primary check: a channel already bound to this teamId exists
  const boundTeamIds = new Set(existingChannels.map((c) => c.teamId).filter(Boolean));
  const existingNames = new Set(existingChannels.map((c) => c.name));
  let createdAny = false;

  for (const preset of [...presets].reverse()) {
    // Skip if any channel is already bound to this team
    if (boundTeamIds.has(preset.id)) continue;
    if (existingNames.has(preset.name)) continue;

    const members = await Promise.all(
      preset.agentFiles.map((file) =>
        ensurePresetAgent(
          preset.id,
          file,
          preset.skillSlugs,
          catalog,
          repoAgents,
          skillsBySlug,
          options.createAgent,
          options.updateAgent,
          updateRepoAgent,
          preset.roles,
        ),
      ),
    );
    const agentIds = members.filter((agent): agent is AgentDefinition => Boolean(agent)).map((agent) => agent.id);
    if (agentIds.length === 0) continue;
    options.createChannel(preset.name, agentIds, preset.avatar, preset.kind, [], preset.id);
    createdAny = true;
  }

  await options.refreshAgents();
  return createdAny;
}

function findAgentByCatalog(
  agents: AgentDefinition[],
  catalogAgent: CatalogAgent,
  roles: TeamRoleDefinition[] = [],
) {
  const role = findRoleByAgentFile(roles, catalogAgent.file);
  const aliases = catalogAgentAliases(
    catalogAgent.file,
    catalogAgent.name,
    catalogAgent.role,
    role ? [role.name] : [],
  ).map((value) => value.trim().toLowerCase());
  return agents.find((agent) => {
    const name = agent.name.trim().toLowerCase();
    const role = (agent.role ?? "").trim().toLowerCase();
    return aliases.includes(name) || (role !== "" && aliases.includes(role));
  });
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}