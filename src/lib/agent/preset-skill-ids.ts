/**
 * Map a workbench agent's catalog skill slugs to Skill-store ids.
 *
 * Agent markdown `skills` / `enabledSkillIds` is the source of truth (including
 * an explicit empty list). Team-wide `skillSlugs` are only a fallback when the
 * agent omits the field.
 */
export function resolvePresetSkillIds(
  catalogEnabledSkillIds: string[] | undefined,
  teamSkillSlugs: string[],
  skillsBySlug: Map<string, string>,
): string[] {
  const slugs =
    catalogEnabledSkillIds !== undefined ? catalogEnabledSkillIds : teamSkillSlugs;
  return Array.from(
    new Set(
      slugs
        .map((slug) => skillsBySlug.get(slug))
        .filter((id): id is string => Boolean(id)),
    ),
  );
}
