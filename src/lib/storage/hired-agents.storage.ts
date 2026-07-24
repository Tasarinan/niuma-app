/**
 * Persisted preference for which catalog agents (by `.niuma/agents` filename
 * filename) are "hired". Shared by the Agents page (browse/hire toggle) and
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

export function loadHiredAgentFiles(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Set(DEFAULT_HIRED);
    const migrated = (JSON.parse(raw) as string[]).map((file) =>
      file.toLowerCase().endsWith(".json") ? file.replace(/\.json$/i, ".md") : file
    );
    return new Set(migrated);
  } catch {
    return new Set(DEFAULT_HIRED);
  }
}

export function saveHiredAgentFiles(files: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...files]));
}
