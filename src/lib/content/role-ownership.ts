/** One workflow role owns a skill or command. Loaded from team `config.yaml` `roles:`. */

import {
  agentMatchesRole,
  resolveDefaultRole,
  type TeamRoleDefinition,
} from "@/lib/agent/team-manifest";

export type ContentRoleOwnership = TeamRoleDefinition;

const BOUNDARY =
  "禁止代做：每个技能和命令只属于上表中的那一个角色。不要 load_skill 别人的技能，不要 bash 跑别人的脚本。";

export function isContentProducer(
  agentName: string,
  producerName?: string,
): boolean {
  const expected = (producerName ?? "").trim();
  if (!expected) return false;
  const name = agentName.trim();
  return name === expected || name.includes(expected);
}

export function formatContentRosterForDispatch(selfName: string, rows: ContentRoleOwnership[]): string {
  const lines = rows.map((role) => {
    const skills = role.skills.length ? `技能 ${role.skills.join("、")}` : "无技能";
    const commands = role.commands.length
      ? `命令 ${role.commands.map((name) => `/${name}`).join(" ")}`
      : "无命令";
    return `- ${role.name}：${role.summary}。${skills}；${commands}`;
  });
  return `${lines.join("\n")}\n\n${BOUNDARY}\n你是 ${selfName}，只做自己那一行。`;
}

export function formatContentDispatchInstruction(
  agentName: string,
  rows: ContentRoleOwnership[],
  producerName?: string,
): string {
  const dispatcher = resolveDefaultRole({ defaultAgent: producerName, roles: rows });
  const dispatcherName = dispatcher?.name ?? producerName ?? "";
  const roster = formatContentRosterForDispatch(agentName, rows);
  const specialists = rows
    .map((role) => role.name)
    .filter((name) => name && name !== dispatcherName)
    .join("、");
  if (dispatcher && agentMatchesRole({ name: agentName }, dispatcher)) {
    return [
      "\n\n[团队协调]",
      `你是接待${dispatcherName}，负责分派，不代做专职工种。`,
      `职责表：\n${roster}`,
      "",
      "规则：",
      "- 先用 1–2 句话接住用户。",
      "- 每轮最多写一行 `ROUTE: @成员名称`，且只点一个人。",
      specialists ? `- 只有你能把任务分给${specialists}。` : "- 只有你能把任务分给职责表里的其他角色。",
      "- 不要代做职责表里其他角色的工作。",
    ].join("\n");
  }
  return [
    "\n\n[团队协调]",
    `职责表：\n${roster}`,
    "",
    "规则：",
    "- 严格只做自己那一行。",
    "- 你不能把任务转给其他专家。",
    dispatcherName
      ? `- 超出职责或缺少前置条件时，说明原因后另起一行写：\`ROUTE: @${dispatcherName}\`。`
      : "- 超出职责时说明原因，不要转派。",
  ].join("\n");
}

export function resolveContentRouteTarget<T extends { name: string; id?: string }>(
  fromAgentName: string,
  routeToken: string,
  channelAgents: T[],
  producerName?: string,
): T | null {
  const needle = routeToken.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, "");
  const match = channelAgents.find((agent) => {
    const n = agent.name.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, "");
    return n.includes(needle) || needle.includes(n);
  });
  if (!match) return null;
  if (isContentProducer(fromAgentName, producerName)) {
    return isContentProducer(match.name, producerName) ? null : match;
  }
  return isContentProducer(match.name, producerName) ? match : null;
}

export function duplicatedSkillSlugs(rows: ContentRoleOwnership[]): string[] {
  const seen = new Map<string, number>();
  for (const role of rows) {
    for (const slug of role.skills) seen.set(slug, (seen.get(slug) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([slug]) => slug);
}

export function duplicatedCommands(rows: ContentRoleOwnership[]): string[] {
  const seen = new Map<string, number>();
  for (const role of rows) {
    for (const command of role.commands) seen.set(command, (seen.get(command) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name);
}
