/**
 * Predefined channel UIs live in the app. A team opts in via
 * `.niuma/teams/<id>/presets/team.yaml` `view:`.
 *
 * Binding: channel.teamId → team pack → view → this registry.
 */

export type TeamChannelMode = "chat" | "editor" | "meeting" | "health";

export const TEAM_CHANNEL_VIEWS: readonly TeamChannelMode[] = [
  "chat",
  "editor",
  "meeting",
  "health",
];

export type TeamChannelHints = {
  id?: string;
  view?: string;
  workflow?: string;
  workspaceRoot?: boolean;
  dataDomain?: string;
  kind?: string;
};

function asView(value: string | undefined): TeamChannelMode | undefined {
  const key = value?.trim().toLowerCase();
  if (!key) return undefined;
  return TEAM_CHANNEL_VIEWS.find((view) => view === key);
}

/**
 * Map a bound team's pack to a built-in UI.
 * Prefer `view:`; fall back to workflow / workspaceRoot / dataDomain.
 */
export function resolveTeamChannelMode(
  hints: TeamChannelHints | null | undefined,
): TeamChannelMode {
  if (!hints) return "chat";
  const declared = asView(hints.view);
  if (declared) return declared;

  const workflow = hints.workflow?.trim().toLowerCase() ?? "";
  if (workflow === "meeting" || hints.kind === "meeting") return "meeting";
  if (hints.workspaceRoot || workflow === "content") return "editor";
  if (workflow === "health" || hints.dataDomain === "healthbook") return "health";
  return "chat";
}

/** Persistable GroupChannel.kind for older meeting channels. */
export function channelKindFromTeam(
  hints: TeamChannelHints | null | undefined,
): "chat" | "meeting" {
  return resolveTeamChannelMode(hints) === "meeting" ? "meeting" : "chat";
}

export function isMeetingChannel(
  hints: TeamChannelHints | null | undefined,
  storedKind?: string,
): boolean {
  const bound = Boolean(
    hints?.id || hints?.view || hints?.workflow || hints?.workspaceRoot || hints?.dataDomain,
  );
  if (bound) return resolveTeamChannelMode(hints) === "meeting";
  return storedKind === "meeting";
}

/** Manuscript draft injections belong only to the editor UI. */
export function usesManuscriptWorkspace(mode: TeamChannelMode): boolean {
  return mode === "editor";
}
