/** Catalog folder names dropped the `aws-` prefix; old DB rows and prompts may still use it. */
export function expandNiumaSkillSlug(source: string): string[] {
  if (source.startsWith("aws-wechat-")) {
    return [source, source.slice("aws-".length)];
  }
  if (source.startsWith("wechat-")) {
    return [source, `aws-${source}`];
  }
  return [source];
}

/** User-facing / prompt skill id — never show legacy `aws-wechat-*`. */
export function canonicalNiumaSkillSlug(source: string): string {
  if (source.startsWith("aws-wechat-")) {
    return source.slice("aws-".length);
  }
  return source;
}
