/** Skill ids are the folder names under each team's skills directory. */

export function canonicalNiumaSkillSlug(source: string): string {
  return source.trim();
}

export function expandNiumaSkillSlug(source: string): string[] {
  const canonical = canonicalNiumaSkillSlug(source);
  return canonical ? [canonical] : [];
}
