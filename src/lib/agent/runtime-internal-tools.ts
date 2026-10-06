import type { AgentInternalToolId } from "@/types";

export interface RuntimeInternalToolOptions {
  bridgedSkillCount: number;
  agentName?: string;
  agentRole?: string;
  /** Role names from team config.yaml that own image commands. */
  imageRoleNames?: string[];
}

function isImageRole(options: RuntimeInternalToolOptions): boolean {
  const names = (options.imageRoleNames ?? []).map((name) => name.trim()).filter(Boolean);
  if (names.length === 0) return false;
  const hay = `${options.agentName ?? ""}\n${options.agentRole ?? ""}`;
  return names.some((name) => hay.includes(name));
}

/** Merge catalog tools with runtime extras for the image role declared in config.yaml. */
export function mergeRuntimeInternalTools(
  enabled: AgentInternalToolId[],
  options: RuntimeInternalToolOptions,
): AgentInternalToolId[] {
  const tools = new Set(enabled);
  if (enabled.includes("generate_image") || isImageRole(options)) {
    tools.add("generate_image");
  }
  if (isImageRole(options)) {
    tools.add("search_images");
    tools.add("save_web_image");
    tools.add("consolidate_draft_images");
  }
  return Array.from(tools);
}
