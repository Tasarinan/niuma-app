/** Whether `src` should be rendered as an <img> (bundled talent icons, http(s), data URLs, etc.). */
export function isAgentAvatarImage(src?: string | null): boolean {
  if (!src?.trim()) return false;
  const s = src.trim();
  if (/^(https?:|data:|blob:|asset:|tauri:)/i.test(s)) return true;
  if (s.startsWith("/") || s.startsWith("./") || s.startsWith("../")) return true;
  if (/^assets[/\\]/i.test(s)) return true;
  if (/[/\\]assets[/\\]/i.test(s) || /[/\\]talent_icon[/\\]/i.test(s)) return true;
  return false;
}

/** Emoji or short text avatar from agent frontmatter; otherwise first letter of label. */
export function agentAvatarGlyph(src?: string | null, label?: string): string {
  const text = src?.trim();
  if (!text || isAgentAvatarImage(text)) {
    return label?.trim()?.slice(0, 1) || "?";
  }
  return text;
}

/** Prefer a renderable image URL from stored agent vs catalog entry. */
export function preferAgentAvatar(stored?: string | null, catalog?: string | null): string {
  const a = stored?.trim() ?? "";
  const b = catalog?.trim() ?? "";
  if (isAgentAvatarImage(a)) return a;
  if (isAgentAvatarImage(b)) return b;
  return a || b;
}
