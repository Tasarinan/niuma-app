/** Catalog folder names dropped the `aws-` prefix; some slugs were renamed again. */

const WECHAT_TO_CANONICAL: Record<string, string> = {
  "wechat-article-assets": "article-assets",
  "wechat-article-publish": "article-publish-wechat",
  "wechat-article-formatting": "article-formatting-wechat",
  "wechat-article-main": "article-main",
  "wechat-article-topics": "article-topics",
  "wechat-article-writing": "article-writing",
  "wechat-article-review": "article-review",
  "wechat-article-images": "article-images",
};

const SLUG_RENAMES: Record<string, string> = {};
const CANONICAL_ALIASES: Record<string, string[]> = {};

for (const [legacy, canonical] of Object.entries(WECHAT_TO_CANONICAL)) {
  SLUG_RENAMES[legacy] = canonical;
  SLUG_RENAMES[`aws-${legacy}`] = canonical;
  CANONICAL_ALIASES[canonical] = [canonical, legacy, `aws-${legacy}`];
}

export function canonicalNiumaSkillSlug(source: string): string {
  const raw = source.trim();
  if (SLUG_RENAMES[raw]) return SLUG_RENAMES[raw];
  if (raw.startsWith("aws-wechat-")) {
    const stripped = raw.slice("aws-".length);
    return SLUG_RENAMES[stripped] ?? stripped;
  }
  return raw;
}

export function expandNiumaSkillSlug(source: string): string[] {
  const canonical = canonicalNiumaSkillSlug(source);
  const extras = CANONICAL_ALIASES[canonical];
  if (extras) {
    return [...new Set([source, canonical, ...extras])];
  }
  if (source.startsWith("aws-wechat-")) {
    return [source, source.slice("aws-".length)];
  }
  if (source.startsWith("wechat-")) {
    return [source, `aws-${source}`];
  }
  return [source];
}
