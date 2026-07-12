/**
 * Seed the agent store from bundled default JSON files in `public/agents/`.
 *
 * Called once on app start: if the store has no agents yet, it fetches
 * `public/agents/index.json` to get the manifest, then loads each file and
 * writes it into the repository.  Subsequent runs are no-ops (store not empty).
 *
 * To regenerate the default files, run:
 *   npx tsx scripts/seed-agents.ts
 */

import { agentDefinitionRepo } from "@/lib/data";

export async function seedDefaultAgentsIfEmpty(): Promise<void> {
  try {
    const existing = await agentDefinitionRepo.list();
    if (existing.length > 0) return;

    const manifest: string[] = await fetch("/agents/index.json").then((r) => {
      if (!r.ok) throw new Error(`index.json ${r.status}`);
      return r.json();
    });

    for (const filename of manifest) {
      try {
        const def = await fetch(`/agents/${filename}`).then((r) => {
          if (!r.ok) throw new Error(`${filename} ${r.status}`);
          return r.json();
        });
        await agentDefinitionRepo.create(def);
      } catch (e) {
        console.warn(`[seed] Skipped ${filename}:`, e);
      }
    }

    console.log(`[seed] Loaded ${manifest.length} default agents.`);
  } catch (e) {
    // Non-fatal: user can still create agents manually
    console.warn("[seed] Could not load default agents:", e);
  }
}
