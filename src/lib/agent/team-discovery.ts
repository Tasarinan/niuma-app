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
  mergeTeamPackManifest,
  type TeamPackManifest,
} from "./team-manifest";
import type { WorkbenchTeamAccent, WorkbenchTeamPreset } from "./workbench-defaults";
import { channelKindFromTeam } from "./team-channel-mode";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
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
  const teamsDir = [root, ".niuma", "teams"].join(separator);
  const entries = await invoke<Array<{ path: string; isDir: boolean }>>("list_directory", {
    path: teamsDir,
  }).catch(() => [] as Array<{ path: string; isDir: boolean }>);

  const packs: TeamPackManifest[] = [];
  for (const entry of entries) {
    if (!entry.isDir) continue;
    const configPath = [entry.path, "config.yaml"].join(separator);
    const raw = await invoke<string>("read_text_file", { path: configPath }).catch(() => "");
    if (!raw.trim()) continue;
    const presetPath = [entry.path, "presets", "team.yaml"].join(separator);
    const extraRaw = await invoke<string>("read_text_file", { path: presetPath }).catch(() => "");
    const extra = extraRaw.trim() ? parseTeamPackManifest(extraRaw) : undefined;
    packs.push(mergeTeamPackManifest(parseTeamPackManifest(raw), extra));
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
  return packs
    .filter(isCatalogTeamPack)
    .map(manifestToWorkbenchPreset);
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
