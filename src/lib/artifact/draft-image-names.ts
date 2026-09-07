/** WeChat-safe draft image names: `cover.png`, `01.png`…, or `{theme}-01.png`. */

export type DraftImageNameIntent = "cover" | "inline";

export interface NormalizeImageNameOptions {
  themeSlug?: string;
  intent?: DraftImageNameIntent;
}

export function isScreenshotLikeFilename(name: string): boolean {
  return /screenshot|屏幕截图|截屏|快照|snip/i.test(name);
}

export function draftThemeSlugFromFolder(folder: string): string {
  const base = folder.replace(/^.*[\\/]/, "").replace(/^\d{8}-/, "");
  const latin = base
    .toLowerCase()
    .split(/[^\w]+/)
    .filter((part) => /^[a-z0-9]+$/.test(part))
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return latin || "draft";
}

export function inferImageNameIntent(filename: string): DraftImageNameIntent {
  const stem = filename
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]+$/i, "")
    .toLowerCase();
  if (stem === "cover" || stem === "封面" || stem === "placeholder_cover") return "cover";
  return "inline";
}

export function isWechatSafeImageFilename(name: string): boolean {
  const file = name.replace(/^.*[\\/]/, "").toLowerCase();
  return (
    /^cover\.png$/i.test(file) ||
    /^\d{2}\.png$/i.test(file) ||
    /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{2}\.png$/i.test(file)
  );
}

function takenSet(existingNames: string[]): Set<string> {
  return new Set(existingNames.map((entry) => entry.replace(/^.*[\\/]/, "").toLowerCase()));
}

export function nextWechatImageFilename(
  existingNames: string[] | Set<string>,
  themeSlug?: string,
): string {
  const taken =
    existingNames instanceof Set
      ? existingNames
      : takenSet(existingNames);
  const slug = themeSlug?.trim().toLowerCase();
  let index = 1;
  while (index < 10000) {
    const num = String(index).padStart(2, "0");
    if (slug) {
      const themed = `${slug}-${num}.png`;
      if (!taken.has(themed)) return themed;
    } else {
      const plain = `${num}.png`;
      if (!taken.has(plain)) return plain;
    }
    index += 1;
  }
  return slug ? `${slug}-99.png` : "99.png";
}

export function normalizeWechatImageFilename(
  name: string,
  existingNames: string[] = [],
  options: NormalizeImageNameOptions = {},
): string {
  const file = name.replace(/^.*[\\/]/, "").toLowerCase();
  const stem = file.replace(/\.[^.]+$/, "");
  const taken = takenSet(existingNames);
  const intent = options.intent ?? inferImageNameIntent(name);
  const themeSlug = options.themeSlug?.trim().toLowerCase();

  if (intent === "cover" && (stem === "cover" || stem === "封面") && !taken.has("cover.png")) {
    return "cover.png";
  }
  if (/^\d{2}$/.test(stem)) {
    const candidate = `${stem}.png`;
    if (!taken.has(candidate)) return candidate;
  }
  if (themeSlug && /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{2}$/.test(stem)) {
    const candidate = `${stem}.png`;
    if (!taken.has(candidate)) return candidate;
  }

  return nextWechatImageFilename(taken, themeSlug);
}
