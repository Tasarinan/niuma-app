/**
 * Composer rules:
 * - `@` mentions a seat in the current team.
 * - `/` completes a team command or a skill (`@写手 请用/article-writing …`).
 * - An explicit `/skill` wins. Otherwise the seat's own skills are used.
 *   A seat with no skills gets the closest match from the team skill catalog.
 */

export type SkillPick = {
  slug: string;
  name: string;
  description?: string;
};

export function parseTrailingSlashQuery(input: string): { query: string; slashIndex: number } | null {
  const match = /\/([^\s]*)$/.exec(input);
  if (!match || match.index === undefined) return null;
  return { query: match[1].toLowerCase(), slashIndex: match.index };
}

/** First `/name` in the message, including after `@坐席 请调用/name …`. */
export function findSlashToken(input: string): { name: string; args: string } | null {
  const match = /\/([A-Za-z][A-Za-z0-9_-]*)(?:\s+([\s\S]*))?/.exec(input.trim());
  if (!match) return null;
  return { name: match[1], args: (match[2] ?? "").trim() };
}

export function extractMentionNames(input: string): string[] {
  const names: string[] = [];
  const re = /@(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    const name = match[1].trim();
    if (name) names.push(name);
  }
  return names;
}

export function replaceTrailingSlashToken(input: string, token: string): string {
  const trailing = parseTrailingSlashQuery(input);
  const before = trailing ? input.slice(0, trailing.slashIndex) : input;
  return `${before}/${token} `;
}

function scoreSkill(skill: SkillPick, text: string): number {
  const hay = text.toLowerCase();
  const needles = [skill.slug, skill.name, skill.description ?? ""]
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  let score = 0;
  for (const part of needles) {
    if (hay.includes(part)) score += part.length;
  }
  return score;
}

/** Closest catalog skill for a seat that declared none. Requires some overlap. */
export function pickBestSkill<T extends SkillPick>(skills: T[], text: string): T | undefined {
  let best: T | undefined;
  let bestScore = 0;
  for (const skill of skills) {
    const score = scoreSkill(skill, text);
    if (score > bestScore) {
      best = skill;
      bestScore = score;
    }
  }
  return best;
}

export function orderSkillsForSeat<T extends SkillPick>(skills: T[], seatSkillSlugs: string[]): T[] {
  const preferred = new Set(seatSkillSlugs.map((slug) => slug.toLowerCase()));
  return [...skills].sort((a, b) => {
    const aHit = preferred.has(a.slug.toLowerCase()) ? 0 : 1;
    const bHit = preferred.has(b.slug.toLowerCase()) ? 0 : 1;
    return aHit - bHit;
  });
}
