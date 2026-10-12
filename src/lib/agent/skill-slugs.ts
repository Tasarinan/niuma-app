/** Skill ids are the folder names under each team's skills directory. */

/** Previous content-team folder names → current kebab slugs. */
const NIUMA_SKILL_SLUG_ALIASES: Record<string, string> = {
  "article-writing": "manuscript-writer",
  "article-topics": "topic-analyzer",
  "article-images": "image-generator",
  "article-review": "manuscript-reviewer",
  "article-formatting": "wechat-formatting",
  "article-formatting-wechat": "wechat-formatting",
  "article-formatting-xhs": "wechat-formatting",
  "article-formatting-zhihu": "wechat-formatting",
  "article-publish": "wechat-publish",
  "article-publish-wechat": "wechat-publish",
  "article-publish-xhs": "wechat-publish",
  "article-publish-zhihu": "wechat-publish",
  "article-main": "content-router",
};

export function canonicalNiumaSkillSlug(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return "";
  return NIUMA_SKILL_SLUG_ALIASES[trimmed] ?? trimmed;
}

export function expandNiumaSkillSlug(source: string): string[] {
  const canonical = canonicalNiumaSkillSlug(source);
  if (!canonical) return [];
  const aliases = Object.entries(NIUMA_SKILL_SLUG_ALIASES)
    .filter(([, target]) => target === canonical)
    .map(([alias]) => alias);
  return Array.from(new Set([canonical, ...aliases]));
}
