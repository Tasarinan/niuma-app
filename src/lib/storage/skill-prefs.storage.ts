/**
 * Persisted preference for which installed `.niuma` skills (by slug) are
 * disabled. Shared by the Skills page (browse/toggle) and the chat compose
 * box's "/" skill picker, so both stay in sync.
 */
const LS_KEY = "niuma-disabled-skills";

export function loadDisabledSkillSlugs(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function saveDisabledSkillSlugs(slugs: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...slugs]));
}
