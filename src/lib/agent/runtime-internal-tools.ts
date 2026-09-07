import type { AgentInternalToolId } from "@/types";

export interface RuntimeInternalToolOptions {
  bridgedSkillCount: number;
  agentName?: string;
  agentRole?: string;
}

function isIllustrator(options: RuntimeInternalToolOptions): boolean {
  const hay = `${options.agentName ?? ""}\n${options.agentRole ?? ""}`;
  return /配图|formatter/i.test(hay);
}

/** Merge catalog tools with runtime extras (generate / search for 配图师). */
export function mergeRuntimeInternalTools(
  enabled: AgentInternalToolId[],
  options: RuntimeInternalToolOptions,
): AgentInternalToolId[] {
  const tools = new Set(enabled);
  if (enabled.includes("generate_image") || isIllustrator(options)) {
    tools.add("generate_image");
  }
  if (isIllustrator(options)) {
    tools.add("search_images");
    tools.add("save_web_image");
  }
  return Array.from(tools);
}
