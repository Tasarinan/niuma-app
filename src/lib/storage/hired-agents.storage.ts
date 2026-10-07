/**
 * Persisted preference for which catalog agents (by filename)
 * are "hired". Shared by the Agents page and the toolbar main chat.
 *
 * First-run defaults come from the catalog team pack (`defaultHired` /
 * `defaultAgent` in `.teams/<id>/config.yaml` with `surface: catalog`).
 */
const LS_KEY = "niuma-hired-agents";
let defaultHiredFiles: string[] = [];

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

export function setDefaultHiredAgentFiles(files: string[]) {
  defaultHiredFiles = [...new Set(files.filter(Boolean))];
}

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
    if (!raw) return new Set(defaultHiredFiles);
    const original = JSON.parse(raw) as string[];
    const migrated = migrateHiredAgentFiles(original);
    const next = new Set(migrated);
    const mapped = original.map(normalizeHiredFile);
    const changed = original.some((file, index) => file !== mapped[index]) || mapped.length !== migrated.length;
    if (changed) saveHiredAgentFiles(next);
    return next;
  } catch {
    return new Set(defaultHiredFiles);
  }
}

export function saveHiredAgentFiles(files: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...files]));
}
