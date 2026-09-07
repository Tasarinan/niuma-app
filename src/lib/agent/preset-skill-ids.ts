/**
 * Map a workbench agent's catalog skill slugs to Skill-store ids.
 *
 * The agent's own `enabledSkillIds` (from its markdown) wins — including an
 * explicit empty list, so roundtable advisors are not stuffed with writing /
 * image / publish skills. Team-wide `skillSlugs` are only a fallback when the
 * agent omitted the field entirely (legacy / teams that share one catalog).
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
