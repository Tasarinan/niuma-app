/**
 * Skill citations typed as `/slug` in the channel composer.
 * The same `/` menu also lists team commands; a matching command wins.
 */

export interface SkillRefCandidate {
  slug: string;
  name: string;
  command: string;
}

export function findCitedSkill<T extends SkillRefCandidate>(
  skills: T[],
  slug: string,
): T | undefined {
  const key = slug.trim().toLowerCase();
  if (!key) return undefined;
  return (
    skills.find((skill) => skill.slug.toLowerCase() === key) ??
    skills.find((skill) => skill.command.toLowerCase() === key) ??
    skills.find((skill) => skill.name.toLowerCase() === key)
  );
}

/** Prompt forwarded to the agent. The chat bubble keeps the typed `/slug` text. */
export function buildSkillCitationPrompt(
  skill: { slug: string; name: string },
  args: string,
): string {
  const request = args.trim() || "按该技能的默认流程执行。";
  const loadName = (skill.name || skill.slug).trim();
  return [
    `请立刻调用 load_skill，name 参数使用 "${loadName}"。若未命中，再试 "${skill.slug}"。`,
    "读完技能全文后严格按其步骤完成本次请求。不要改用其他技能，不要把技能说明复述给用户代替执行。",
    "",
    "用户要求：",
    request,
  ].join("\n");
}
