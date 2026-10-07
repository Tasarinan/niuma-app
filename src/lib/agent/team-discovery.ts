import { invoke } from "@tauri-apps/api/core";
import type { GroupChannel } from "@/types";
import {
  isCatalogTeamPack,
  listAgentFilesFromManifest,
  listDefaultCommandFromManifest,
  listDefaultHiredFromManifest,
  listSkillSlugsFromManifest,
  manifestToCommandDir,
  parseTeamPackManifest,
  type TeamPackManifest,
} from "./team-manifest";
import { sortRolesWithDefaultFirst, teamRolesFromAgentMarkdown } from "./team-roles-from-agents";
import type { WorkbenchTeamAccent, WorkbenchTeamPreset } from "./workbench-defaults";
import { channelKindFromTeam } from "./team-channel-mode";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Top-level folders under `.teams/<teamId>/skills` that contain SKILL.md. */
export async function listSkillSlugsFromTeamSkillsDir(teamId: string): Promise<string[]> {
  if (!isTauri() || !teamId.trim()) return [];

  const root = await invoke<string>("get_niuma_root_dir").catch(() => "");
  if (!root) return [];

  const separator = root.includes("/") ? "/" : "\\";
  const skillsDir = [root, ".teams", teamId, "skills"].join(separator);
  const entries = await invoke<Array<{ name: string; path: string; isDir: boolean }>>("list_directory", {
    path: skillsDir,
  }).catch(() => [] as Array<{ name: string; path: string; isDir: boolean }>);

  const slugs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDir) continue;
    const skillPath = [entry.path, "SKILL.md"].join(separator);
    const raw = await invoke<string>("read_text_file", { path: skillPath }).catch(() => "");
    if (raw.trim()) slugs.push(entry.name);
  }
  return slugs.sort((a, b) => a.localeCompare(b));
}

function isWorkbenchTeamAccent(value: string | undefined): value is WorkbenchTeamAccent {
  return value === "rose" || value === "emerald" || value === "sky" || value === "violet" || value === "amber";
}

export function manifestToWorkbenchPreset(manifest: TeamPackManifest): WorkbenchTeamPreset {
  const id = manifest.id ?? "unknown";
  return {
    id,
    name: manifest.name ?? id,
    eyebrow: manifest.eyebrow ?? "",
    description: manifest.description ?? "",
    avatar: manifest.avatar ?? "💬",
    accent: isWorkbenchTeamAccent(manifest.accent) ? manifest.accent : "violet",
    kind: channelKindFromTeam(manifest),
    commandDir: manifestToCommandDir(manifest),
    agentFiles: listAgentFilesFromManifest(manifest),
    skillSlugs: listSkillSlugsFromManifest(manifest),
    starterPrompts: manifest.starterPrompts,
    workflow: manifest.workflow,
    view: manifest.view,
    workspaceRoot: manifest.workspaceRoot,
    roles: manifest.roles,
    defaultAgent: manifest.defaultAgent,
    defaultCommand: listDefaultCommandFromManifest(manifest),
    dataDomain: manifest.dataDomain,
    channelName: manifest.channelName,
    defaultHired: listDefaultHiredFromManifest(manifest),
  };
}

export async function discoverTeamPacks(): Promise<TeamPackManifest[]> {
  if (!isTauri()) return [];

  const root = await invoke<string>("get_niuma_root_dir").catch(() => "");
  if (!root) return [];

  const separator = root.includes("/") ? "/" : "\\";
  const teamsDir = [root, ".teams"].join(separator);
  const entries = await invoke<Array<{ path: string; isDir: boolean }>>("list_directory", {
    path: teamsDir,
  }).catch(() => [] as Array<{ path: string; isDir: boolean }>);

  const packs: TeamPackManifest[] = [];
  for (const entry of entries) {
    if (!entry.isDir) continue;
    const teamPath = [entry.path, "team.yaml"].join(separator);
    const legacyConfigPath = [entry.path, "config.yaml"].join(separator);
    let raw = await invoke<string>("read_text_file", { path: teamPath }).catch(() => "");
    if (!raw.trim()) {
      raw = await invoke<string>("read_text_file", { path: legacyConfigPath }).catch(() => "");
    }
    if (!raw.trim()) continue;

    const manifest = parseTeamPackManifest(raw);
    const agentsDir = [entry.path, "agents"].join(separator);
    const agentEntries = await invoke<Array<{ name: string; path: string; isDir: boolean }>>(
      "list_directory",
      { path: agentsDir },
    ).catch(() => [] as Array<{ name: string; path: string; isDir: boolean }>);
    const agentFiles: Array<{ file: string; raw: string }> = [];
    for (const agentEntry of agentEntries) {
      if (agentEntry.isDir || !agentEntry.name.endsWith(".md")) continue;
      const agentRaw = await invoke<string>("read_text_file", { path: agentEntry.path }).catch(() => "");
      if (!agentRaw.trim()) continue;
      agentFiles.push({ file: agentEntry.name, raw: agentRaw });
    }
    const roles = sortRolesWithDefaultFirst(
      teamRolesFromAgentMarkdown(agentFiles, manifest.id ?? ""),
      manifest.defaultAgent,
    );
    packs.push({ ...manifest, roles });
  }

  return packs.sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""));
}

export async function discoverWorkbenchTeamPresets(): Promise<WorkbenchTeamPreset[]> {
  const packs = await discoverTeamPacks();
  return packs
    .filter((pack) => !isCatalogTeamPack(pack))
    .map(manifestToWorkbenchPreset);
}

/** Shared talent pool / toolbar chat. Not a workbench channel. */
export async function discoverCatalogTeamPresets(): Promise<WorkbenchTeamPreset[]> {
  const packs = await discoverTeamPacks();
  const presets: WorkbenchTeamPreset[] = [];
  for (const pack of packs.filter(isCatalogTeamPack)) {
    const preset = manifestToWorkbenchPreset(pack);
    const diskSlugs = pack.id ? await listSkillSlugsFromTeamSkillsDir(pack.id) : [];
    if (diskSlugs.length > 0) preset.skillSlugs = diskSlugs;
    presets.push(preset);
  }
  return presets;
}

/** Workbench channels plus catalog packs (e.g. 主对话 / `teams/main`). */
export async function loadChannelTeamPresets(): Promise<WorkbenchTeamPreset[]> {
  if (!isTauri()) return [];
  const [catalog, workbench] = await Promise.all([
    discoverCatalogTeamPresets(),
    discoverWorkbenchTeamPresets(),
  ]);
  return [...catalog, ...workbench];
}

export function getTeamPackByChannel(
  channel: GroupChannel | null | undefined,
  presets: WorkbenchTeamPreset[],
): WorkbenchTeamPreset | null {
  if (!channel?.teamId) {
    const channelName = channel?.name.trim() ?? "";
    if (!channelName) return null;
    return (
      presets.find((preset) => preset.name === channelName) ?? null
    );
  }
  return presets.find((preset) => preset.id === channel.teamId) ?? null;
}
