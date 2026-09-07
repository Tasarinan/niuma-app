/** Match slash-command `agent:` frontmatter to hired channel members. */

export const CATALOG_FILE_ALIASES: Record<string, string[]> = {
  "producer.md": ["主理人", "主题人", "producer"],
  "wechat-researcher.md": ["小蜜蜂", "微信选题员", "wechat-researcher"],
  "wechat-director.md": ["灵感大师", "微信总监", "wechat-director"],
  "gzh-expert.md": ["公众号高手", "gzh-expert"],
  "brand-advisor.md": ["品牌顾问", "brand-advisor"],
  "marketing.md": ["营销策划", "marketing"],
  "video-director.md": ["视频编导", "video-director"],
  "wechat-writer.md": ["写手", "微信写手", "wechat-writer"],
  "wechat-formatter.md": ["配图师", "微信排版", "wechat-formatter"],
  "wechat-reviewer.md": ["小主编", "微信审稿", "wechat-reviewer"],
  "wechat-publisher.md": ["小助理", "微信发布", "wechat-publisher"],
};

const ALIAS_GROUPS: string[][] = [
  ["主理人", "主题人", "producer"],
  ["小蜜蜂", "微信选题员", "wechat-researcher", "信息采集"],
  ["灵感大师", "微信总监", "wechat-director", "选题灵感"],
  ["公众号高手", "gzh-expert", "公众号手艺"],
  ["品牌顾问", "brand-advisor", "品牌建议"],
  ["营销策划", "marketing", "营销方案"],
  ["视频编导", "video-director", "视频内容"],
  ["写手", "微信写手", "wechat-writer"],
  ["配图师", "微信排版", "wechat-formatter"],
  ["小主编", "微信审稿", "wechat-reviewer"],
  ["小助理", "微信发布", "wechat-publisher"],
];

export interface CommandTargetAgent {
  name: string;
  role?: string;
  description?: string;
  id?: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\.md$/i, "");
}

function expandTarget(target: string): Set<string> {
  const needle = normalize(target);
  const group = ALIAS_GROUPS.find((names) => names.some((name) => normalize(name) === needle));
  return new Set((group ?? [target]).map(normalize));
}

export function agentMatchesCommandTarget(
  agent: CommandTargetAgent,
  target: string,
): boolean {
  const aliases = expandTarget(target);
  const fields = [agent.name, agent.role].filter(Boolean).map((value) => normalize(String(value)));
  return fields.some((field) => aliases.has(field));
}

export function selectAgentsForCommand<T extends CommandTargetAgent>(
  agents: T[],
  targets: string[],
): T[] {
  if (targets.length === 0) return agents;
  return agents.filter((agent) => targets.some((target) => agentMatchesCommandTarget(agent, target)));
}

export function shouldSmartDispatch<T extends CommandTargetAgent>(options: {
  channelAgents: T[];
  targetAgentNames?: string[];
  mentionCount: number;
}): boolean {
  if (options.mentionCount > 0 || options.channelAgents.length <= 1) return false;
  const names = options.targetAgentNames ?? [];
  if (names.length === 0) return true;
  if (names.length > 1) return false;
  return selectAgentsForCommand(options.channelAgents.slice(0, 1), names).length > 0;
}

export function missingCommandAgentMessage(targets: string[]): string {
  const label = targets.filter(Boolean).join("、") || "指定角色";
  return `频道里没有找到「${label}」，所以这次没有生成回复。请确认内容创作团队已入职该角色，并刷新工作台后再试 /wechat。`;
}

export function catalogAgentAliases(file: string, name?: string, role?: string): string[] {
  return [name, role, ...(CATALOG_FILE_ALIASES[file] ?? [])].filter(
    (value): value is string => Boolean(value && value.trim()),
  );
}
