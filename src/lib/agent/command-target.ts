/** Match slash-command `agent:` frontmatter to hired channel members. */

export interface CommandTargetAgent {
  name: string;
  role?: string;
  description?: string;
  id?: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\.md$/i, "");
}

export function agentMatchesCommandTarget(
  agent: CommandTargetAgent,
  target: string,
): boolean {
  const needle = normalize(target);
  if (!needle) return false;
  const fields = [agent.name, agent.role].filter(Boolean).map((value) => normalize(String(value)));
  return fields.some((field) => field === needle || field.includes(needle) || needle.includes(field));
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

export function missingCommandAgentMessage(targets: string[], defaultCommand?: string): string {
  const label = targets.filter(Boolean).join("、") || "指定角色";
  const cmd = (defaultCommand ?? "").trim().replace(/^\//, "");
  const hint = cmd ? `并刷新工作台后再试 /${cmd}` : "并刷新工作台后再试";
  return `频道里没有找到「${label}」，所以这次没有生成回复。请确认该团队已入职该角色，${hint}。`;
}

export function catalogAgentAliases(
  file: string,
  name?: string,
  role?: string,
  extra: string[] = [],
): string[] {
  const stem = file.replace(/\.md$/i, "");
  return [name, role, stem, ...extra].filter(
    (value): value is string => Boolean(value && value.trim()),
  );
}
