function recordFromArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) return {};
  return args as Record<string, unknown>;
}

import { canonicalNiumaSkillSlug } from "./skill-slugs";

function namedArg(args: unknown, keys: string[]): string {
  const record = recordFromArgs(args);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

const HIDDEN_TOOLS = new Set([
  "bash",
  "read",
  "write",
  "edit",
  "ls",
  "grep",
  "file_search",
]);

/** Short status line shown in chat while an agent tool/skill is running. */
export function describeAgentToolProgress(toolName: string, args?: unknown): string | null {
  if (HIDDEN_TOOLS.has(toolName)) return null;
  const skill = namedArg(args, ["name", "skill"]);
  if (toolName === "load_skill" || toolName === "run_skill") {
    const label = skill ? canonicalNiumaSkillSlug(skill) : "";
    return label ? `正在使用技能 ${label}` : "正在使用技能";
  }
  if (toolName === "generate_image") {
    return "正在用系统图片模型生成配图";
  }
  if (toolName === "search_images") {
    return "正在网上搜索类似图片";
  }
  if (toolName === "save_web_image") {
    return "正在把网上的图保存为 PNG";
  }
  if (toolName === "open_article") {
    return "正在定位当前文稿";
  }
  return null;
}

export function describeAgentToolDone(label: string): string {
  if (label.startsWith("正在使用技能")) return label.replace(/^正在/, "");
  return label.replace(/^正在/, "已");
}
