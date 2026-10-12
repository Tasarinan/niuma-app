import { expandNiumaSkillSlug } from "./skill-slugs";

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
      slugs.flatMap((slug) => {
        for (const key of expandNiumaSkillSlug(slug)) {
          const id = skillsBySlug.get(key);
          if (id) return [id];
        }
        return [];
      }),
    ),
  );
}
