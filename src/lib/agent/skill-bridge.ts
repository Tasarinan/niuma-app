/**
 * Bridges file-based `.niuma/skills/<slug>/SKILL.md` definitions
 * into the DB-backed `Skill` store consumed by `resolveAgent` (via `load_skill`/`run_skill`).
 *
 * Without this bridge the two skill systems are disconnected: toggling a skill
 * on the Skills page only affects its own catalog view, not what an agent can
 * actually load/run in chat. Call `bridgeEnabledNiumaSkills()` right before
 * sending a message and merge the returned ids into the responding agent's
 * `enabledSkillIds` for that turn.
 */
import { fetchNiumaSkillCatalog, type NiumaSkill } from "@/lib/data";
import { loadDisabledSkillSlugs } from "@/lib/storage";
import { useSkillStore } from "@/store";

/**
 * Finds-or-creates a `Skill` record for every .niuma skill that's currently
 * enabled (frontmatter `enabled` + not in the user's disabled-slug set), and
 * returns their ids. Existing bridged records are kept in sync with the
 * source SKILL.md content in case it changed on disk.
 */
export async function bridgeEnabledNiumaSkills(): Promise<string[]> {
  let store = useSkillStore.getState();
  if (!store.loaded) {
    await store.load();
    store = useSkillStore.getState();
  }

  const disabledSlugs = loadDisabledSkillSlugs();
  let catalog: NiumaSkill[];
  try {
    catalog = await fetchNiumaSkillCatalog();
  } catch {
    return [];
  }
  const enabled = catalog.filter(
    (s) => s.enabled !== false && !disabledSlugs.has(s.slug)
  );

  const ids: string[] = [];
  for (const cs of enabled) {
    const id = await findOrCreateBridgedSkill(cs);
    ids.push(id);
  }
  return ids;
}

async function findOrCreateBridgedSkill(cs: NiumaSkill): Promise<string> {
  const store = useSkillStore.getState();
  const existing = store.items.find(
    (s) => s.sourceType === "niuma" && s.source === cs.slug
  );

  if (existing) {
    if (
      existing.content !== cs.raw ||
      existing.description !== cs.description ||
      existing.name !== cs.name
    ) {
      const updated = await store.edit(existing.id, {
        name: cs.name,
        description: cs.description,
        content: cs.raw,
      });
      return (updated ?? existing).id;
    }
    return existing.id;
  }

  const created = await store.add({
    name: cs.name,
    description: cs.description,
    enabled: true,
    tags: cs.category ? [cs.category] : [],
    content: cs.raw,
    sourceType: "niuma",
    source: cs.slug,
  });
  return created.id;
}
