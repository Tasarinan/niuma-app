/**
 * Map a workbench agent's catalog skill slugs to Skill-store ids.
 *
 * Team `config.yaml` `roles[].skills` is the source of truth when present.
 * The agent's markdown `enabledSkillIds` is next (including an explicit empty
 * list). Team-wide `skillSlugs` are only a fallback for packs without roles.
 */
export function resolvePresetSkillIds(
  catalogEnabledSkillIds: string[] | undefined,
  teamSkillSlugs: string[],
  skillsBySlug: Map<string, string>,
  roleSkillSlugs?: string[],
): string[] {
  const slugs =
    roleSkillSlugs !== undefined
      ? roleSkillSlugs
      : catalogEnabledSkillIds !== undefined
        ? catalogEnabledSkillIds
        : teamSkillSlugs;
  return Array.from(
    new Set(
      slugs
        .map((slug) => skillsBySlug.get(slug))
        .filter((id): id is string => Boolean(id)),
    ),
  );
}
