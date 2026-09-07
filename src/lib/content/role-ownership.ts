/** One content-team role owns a skill or command. Nobody else may load or run it. */

export const CONTENT_PRODUCER_NAME = "主理人";

export type ContentRoleOwnership = {
  agentFile: string;
  name: string;
  skills: string[];
  commands: string[];
  summary: string;
};

export const CONTENT_ROLE_OWNERSHIP: ContentRoleOwnership[] = [
  {
    agentFile: "producer.md",
    name: "主理人",
    skills: ["wechat-article-main", "xhs-main", "blog-main"],
    commands: ["wechat", "xhs", "blog"],
    summary: "开流程、主持圆桌、定题、建目录、点名",
  },
  {
    agentFile: "wechat-director.md",
    name: "灵感大师",
    skills: [],
    commands: [],
    summary: "圆桌抛火花、拆角度；不定题",
  },
  {
    agentFile: "wechat-researcher.md",
    name: "小蜜蜂",
    skills: ["wechat-article-topics"],
    commands: [],
    summary: "remix 已注入的中央 feed 简报",
  },
  {
    agentFile: "gzh-expert.md",
    name: "公众号高手",
    skills: [],
    commands: [],
    summary: "圆桌谈标题、栏目、留人",
  },
  {
    agentFile: "brand-advisor.md",
    name: "品牌顾问",
    skills: [],
    commands: [],
    summary: "圆桌谈人设、语气、能不能发",
  },
  {
    agentFile: "marketing.md",
    name: "营销策划",
    skills: [],
    commands: [],
    summary: "圆桌谈卖点、系列",
  },
  {
    agentFile: "video-director.md",
    name: "视频编导",
    skills: [],
    commands: [],
    summary: "圆桌谈影像钩子；不剪视频",
  },
  {
    agentFile: "wechat-writer.md",
    name: "写手",
    skills: ["wechat-article-writing"],
    commands: [],
    summary: "写/改 article.md",
  },
  {
    agentFile: "wechat-formatter.md",
    name: "配图师",
    skills: ["wechat-article-images"],
    commands: [],
    summary: "生/搜 PNG 到 imgs/，改文中图片引用",
  },
  {
    agentFile: "wechat-reviewer.md",
    name: "小主编",
    skills: ["wechat-article-review"],
    commands: [],
    summary: "审 article.md，写 review.md",
  },
  {
    agentFile: "wechat-publisher.md",
    name: "小助理",
    skills: ["wechat-article-formatting", "wechat-article-publish", "wechat-article-assets"],
    commands: ["publish", "ready", "layout"],
    summary: "排版 HTML、发布、素材落盘",
  },
];

const BOUNDARY =
  "禁止代做：每个技能和命令只属于上表中的那一个角色。不要 load_skill 别人的技能，不要 bash 跑别人的脚本。";

export function isContentProducer(agentName: string): boolean {
  const name = agentName.trim();
  return name === CONTENT_PRODUCER_NAME || name.includes(CONTENT_PRODUCER_NAME);
}

export function formatContentRosterForDispatch(selfName: string): string {
  const lines = CONTENT_ROLE_OWNERSHIP.map((role) => {
    const skills = role.skills.length ? `技能 ${role.skills.join("、")}` : "无技能";
    const commands = role.commands.length
      ? `命令 ${role.commands.map((name) => `/${name}`).join(" ")}`
      : "无命令";
    return `- ${role.name}：${role.summary}。${skills}；${commands}`;
  });
  return `${lines.join("\n")}\n\n${BOUNDARY}\n你是 ${selfName}，只做自己那一行。`;
}

export function formatContentDispatchInstruction(agentName: string): string {
  const roster = formatContentRosterForDispatch(agentName);
  if (isContentProducer(agentName)) {
    return [
      "\n\n[团队协调]",
      "你是接待主理人，负责分派，不代做专职工种。",
      `职责表：\n${roster}`,
      "",
      "规则：",
      "- 先用 1–2 句话接住用户。",
      "- 每轮最多写一行 `ROUTE: @成员名称`，且只点一个人。",
      "- 只有你能把任务分给写手、配图师、小主编、小助理等成员。",
      "- 不要自己写正文、配图、审稿、排版或发布。",
    ].join("\n");
  }
  return [
    "\n\n[团队协调]",
    `职责表：\n${roster}`,
    "",
    "规则：",
    "- 严格只做自己那一行。",
    "- 你不能把任务转给其他专家；禁止 `ROUTE: @写手` / `@配图师` 等。",
    "- 超出职责或缺少前置条件时，说明原因后另起一行写：`ROUTE: @主理人`。",
  ].join("\n");
}

export function resolveContentRouteTarget<T extends { name: string; id?: string }>(
  fromAgentName: string,
  routeToken: string,
  channelAgents: T[],
): T | null {
  const needle = routeToken.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, "");
  const match = channelAgents.find((agent) => {
    const n = agent.name.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, "");
    return n.includes(needle) || needle.includes(n);
  });
  if (!match) return null;
  if (isContentProducer(fromAgentName)) {
    return isContentProducer(match.name) ? null : match;
  }
  return isContentProducer(match.name) ? match : null;
}

export function duplicatedSkillSlugs(rows = CONTENT_ROLE_OWNERSHIP): string[] {
  const seen = new Map<string, number>();
  for (const role of rows) {
    for (const slug of role.skills) seen.set(slug, (seen.get(slug) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([slug]) => slug);
}

export function duplicatedCommands(rows = CONTENT_ROLE_OWNERSHIP): string[] {
  const seen = new Map<string, number>();
  for (const role of rows) {
    for (const command of role.commands) seen.set(command, (seen.get(command) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name);
}
