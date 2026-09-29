/**
 * Persisted preference for which catalog agents (by `.niuma/agents` filename)
 * are "hired". Shared by the Agents page (browse/hire toggle) and
 * the agent-chat main channel's default-agent resolution, so both stay in
 * sync.
 *
 * "assistant.md" (the general-purpose Assistant) is hired by default for
 * first-time users, so the main chat has a sensible agent out of the box.
 * Once the user has saved any preference (including explicitly dismissing
 * it), that choice is respected.
 */
const LS_KEY = "niuma-hired-agents";
const DEFAULT_HIRED = ["assistant.md"];

/** Old catalog filenames folded into the current specialists. */
export const CATALOG_HIRED_FILE_MIGRATION: Record<string, string> = {
  "bob.md": "dev.md",
  "charlie.md": "dev.md",
  "leo.md": "dev.md",
  "kate.md": "dev.md",
  "kai.md": "alice.md",
  "jack.md": "alice.md",
  "eve.md": "diana.md",
  "henry.md": "grace.md",
  "mary.md": "grace.md",
  "nick.md": "grace.md",
  "frank.md": "atlas.md",
  "olivia.md": "atlas.md",
};

function normalizeHiredFile(file: string): string {
  const asMd = file.toLowerCase().endsWith(".json") ? file.replace(/\.json$/i, ".md") : file;
  return CATALOG_HIRED_FILE_MIGRATION[asMd] ?? asMd;
}

export function migrateHiredAgentFiles(files: string[]): string[] {
  return [...new Set(files.map(normalizeHiredFile))];
}

export function loadHiredAgentFiles(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Set(DEFAULT_HIRED);
    const original = JSON.parse(raw) as string[];
    const migrated = migrateHiredAgentFiles(original);
    const next = new Set(migrated);
    const mapped = original.map(normalizeHiredFile);
    const changed = original.some((file, index) => file !== mapped[index]) || mapped.length !== migrated.length;
    if (changed) saveHiredAgentFiles(next);
    return next;
  } catch {
    return new Set(DEFAULT_HIRED);
  }
}

export function saveHiredAgentFiles(files: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...files]));
}
