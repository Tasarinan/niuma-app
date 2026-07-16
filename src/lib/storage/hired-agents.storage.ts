/**
 * Persisted preference for which catalog agents (by clawpacks/agents/*.json
 * filename) are "hired". Shared by the Agents page (browse/hire toggle) and
 * the agent-chat main channel's default-agent resolution, so both stay in
 * sync.
 *
 * "assistant.json" (the general-purpose Assistant) is hired by default for
 * first-time users, so the main chat has a sensible agent out of the box.
 * Once the user has saved any preference (including explicitly dismissing
 * it), that choice is respected.
 */
const LS_KEY = "niuma-hired-agents";
const DEFAULT_HIRED = ["assistant.json"];

export function loadHiredAgentFiles(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set(DEFAULT_HIRED);
  } catch {
    return new Set(DEFAULT_HIRED);
  }
}

export function saveHiredAgentFiles(files: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...files]));
}
