/** Match slash-command `agent:` frontmatter to hired channel members. */

export const CATALOG_FILE_ALIASES: Record<string, string[]> = {
  "producer.md": ["主理人", "主题人", "producer"],
  "desk.md": ["采编", "小蜜蜂", "灵感大师", "微信选题员", "wechat-researcher", "wechat-director"],
  "writer.md": ["写手", "微信写手", "wechat-writer"],
  "illustrator.md": ["配图师", "微信排版", "wechat-formatter"],
  "chief.md": ["主编", "小主编", "微信审稿", "wechat-reviewer"],
  "publisher.md": ["发行", "小助理", "微信发布", "wechat-publisher"],
};

const ALIAS_GROUPS: string[][] = [
  ["主理人", "主题人", "producer"],
  [
    "采编",
    "小蜜蜂",
    "灵感大师",
    "微信选题员",
    "wechat-researcher",
    "wechat-director",
    "信息采集",
    "选题灵感",
    "公众号高手",
    "gzh-expert",
    "品牌顾问",
    "brand-advisor",
    "营销策划",
    "marketing",
    "视频编导",
    "video-director",
  ],
  ["写手", "微信写手", "wechat-writer"],
  ["配图师", "微信排版", "wechat-formatter"],
  ["主编", "小主编", "微信审稿", "wechat-reviewer"],
  ["发行", "小助理", "微信发布", "wechat-publisher", "排版与发布"],
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
  return `频道里没有找到「${label}」，所以这次没有生成回复。请确认内容创作团队已入职该角色，并刷新工作台后再试 /article create。`;
}

export function catalogAgentAliases(file: string, name?: string, role?: string): string[] {
  return [name, role, ...(CATALOG_FILE_ALIASES[file] ?? [])].filter(
    (value): value is string => Boolean(value && value.trim()),
  );
}
