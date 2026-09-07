import { draftThemeSlugFromFolder, inferImageNameIntent, normalizeWechatImageFilename, type NormalizeImageNameOptions } from "./draft-image-names";
import { draftFolderFromFilePath } from "./draft-workspace";
import { normalizeDraftPath } from "./drafts";
import { imageMimeFromPath, normalizeFsPath } from "./workspace-path";
function parseMarkdownImageTarget(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return trimmed.slice(1, -1).trim();
  }
  const quoted = trimmed.match(/^(.+?)\s+(?:"[^"]*"|'[^']*')\s*$/);
  return (quoted?.[1] ?? trimmed).trim();
}

const MD_IMAGE = /!\[([^\]]*)\]\(([^)]*)\)/g;

export function isRemoteOrDataImageSrc(src: string): boolean {
  return /^(data:|https?:|asset:|blob:|tauri:)/i.test(src.trim());
}

/** Keep data/blob/local image URLs that react-markdown would otherwise strip. */
export function previewUrlTransform(url: string): string {
  const value = url.trim();
  if (!value) return "";
  if (isRemoteOrDataImageSrc(value)) return value;
  if (/^[a-zA-Z]:[\\/]/.test(value)) return value;
  const colon = value.indexOf(":");
  if (colon === -1) return value;
  const slash = value.indexOf("/");
  const query = value.indexOf("?");
  const hash = value.indexOf("#");
  if (
    (slash !== -1 && colon > slash) ||
    (query !== -1 && colon > query) ||
    (hash !== -1 && colon > hash)
  ) {
    return value;
  }
  return "";
}

export function resolvePreviewImageSrc(
  src: string,
  articleFilePath: string | undefined,
  toAssetUrl?: (absPath: string) => string,
): string {
  const trimmed = src.trim();
  if (!trimmed) return "";
  if (isRemoteOrDataImageSrc(trimmed)) return trimmed;
  if (!articleFilePath || !toAssetUrl) return previewUrlTransform(trimmed);
  const abs = resolveLocalImagePath(articleFilePath, trimmed);
  if (!abs) return previewUrlTransform(trimmed);
  try {
    return toAssetUrl(abs);
  } catch {
    return previewUrlTransform(trimmed);
  }
}

export function markdownHasUnresolvedLocalImages(markdown: string): boolean {
  return collectMarkdownImageSrcs(markdown).some((src) => !isRemoteOrDataImageSrc(src));
}

export function collectMarkdownImageSrcs(markdown: string): string[] {
  return [...markdown.matchAll(MD_IMAGE)]
    .map((match) => parseMarkdownImageTarget(match[2] ?? ""))
    .filter(Boolean);
}

const LOCAL_IMAGE_EXTS = [".png", ".jfif", ".jpg", ".jpeg", ".webp", ".gif"];

export function toPngMarkdownSrc(src: string): string {
  if (isRemoteOrDataImageSrc(src)) return src;
  const trimmed = src.trim();
  if (/\.png$/i.test(trimmed)) return trimmed;
  return trimmed.replace(/\.[^./]+$/, ".png");
}

export function toImgsMarkdownSrc(
  src: string,
  existingNames: string[] = [],
  options: NormalizeImageNameOptions = {},
): string {
  if (isRemoteOrDataImageSrc(src)) return src;
  const name = src.trim().replace(/\\/g, "/").replace(/^.*\//, "") || "01.png";
  const safe = normalizeWechatImageFilename(toPngMarkdownSrc(name), existingNames, options);
  return `imgs/${safe}`;
}

/** Try the markdown src first, then the same stem with WeChat-safe fallbacks. */
export function localImageReadCandidates(absPath: string): string[] {
  const normalized = absPath.replace(/\\/g, "/");
  const dir = normalized.replace(/\/[^/]+$/, "");
  const file = normalized.slice(dir.length + 1);
  const stem = file.replace(/\.[^./]+$/, "");
  const dirs = [dir];
  if (dir && !/\/imgs$/i.test(dir)) dirs.push(`${dir}/imgs`);
  const candidates: string[] = [];
  for (const folder of dirs) {
    candidates.push(`${folder}/${file}`);
    for (const ext of LOCAL_IMAGE_EXTS) {
      candidates.push(`${folder}/${stem}${ext}`);
    }
  }
  return [...new Set(candidates)];
}

/** Resolve a markdown image src against the article file's folder. */
export function resolveLocalImagePath(articleFilePath: string, src: string): string | null {
  const trimmed = src.trim().replace(/^<|>$/g, "");
  if (!trimmed || isRemoteOrDataImageSrc(trimmed) || trimmed.startsWith("#")) return null;
  const articlePath = normalizeFsPath(normalizeDraftPath(articleFilePath));
  const folder = articlePath.replace(/\/[^/]+$/, "");
  if (!folder) return null;
  const rel = trimmed.replace(/\\/g, "/").replace(/^\.\//, "");
  if (/^[a-zA-Z]:\//.test(rel) || rel.startsWith("/")) return normalizeFsPath(rel);
  return normalizeFsPath(`${folder}/${rel}`);
}

export function replaceMarkdownImageSrcs(
  markdown: string,
  replaceSrc: (src: string, alt: string) => string,
): string {
  return markdown.replace(MD_IMAGE, (_all, alt: string, inner: string) => {
    const src = parseMarkdownImageTarget(inner ?? "");
    const next = replaceSrc(src, alt);
    const title = inner.trim().slice(src.length).trim();
    const suffix = title ? ` ${title}` : "";
    return `![${alt}](${next}${suffix})`;
  });
}

export function lookupMappedImageSrc(src: string, srcMap: Map<string, string>): string | undefined {
  if (srcMap.has(src)) return srcMap.get(src);
  let decoded = src;
  try {
    decoded = decodeURIComponent(src);
  } catch {
    // keep original
  }
  if (decoded !== src && srcMap.has(decoded)) return srcMap.get(decoded);
  const compact = decoded.replace(/\s/g, "");
  for (const [dataUrl, original] of srcMap) {
    if (dataUrl.replace(/\s/g, "") === compact) return original;
  }
  return undefined;
}

export function relativizeMarkdownImages(markdown: string, srcMap: Map<string, string>): string {
  if (srcMap.size === 0) return markdown;
  return replaceMarkdownImageSrcs(markdown, (src) => lookupMappedImageSrc(src, srcMap) ?? src);
}

export async function inlineLocalMarkdownImages(
  markdown: string,
  articleFilePath: string | undefined,
  readBase64: (path: string) => Promise<string>,
): Promise<{ markdown: string; srcMap: Map<string, string> }> {
  const srcMap = new Map<string, string>();
  if (!articleFilePath || !markdownHasUnresolvedLocalImages(markdown)) {
    return { markdown, srcMap };
  }

  const folder = articleFilePath ? draftFolderFromFilePath(articleFilePath) : null;
  const themeSlug = folder ? draftThemeSlugFromFolder(folder) : undefined;
  const taken: string[] = [];

  const unique = [...new Set(collectMarkdownImageSrcs(markdown).filter((src) => !isRemoteOrDataImageSrc(src)))];
  const dataUrls = new Map<string, string>();
  await Promise.all(
    unique.map(async (src) => {
      const abs = resolveLocalImagePath(articleFilePath, src);
      if (!abs) return;
      for (const candidate of localImageReadCandidates(abs)) {
        const base64 = await readBase64(candidate).catch(() => "");
        if (!base64) continue;
        const dataUrl = `data:${imageMimeFromPath(candidate)};base64,${base64}`;
        dataUrls.set(src, dataUrl);
        const relative = toImgsMarkdownSrc(src, taken, {
          themeSlug,
          intent: inferImageNameIntent(src),
        });
        taken.push(relative.replace(/^imgs\//i, ""));
        srcMap.set(dataUrl, relative);
        return;
      }
    }),
  );

  if (dataUrls.size === 0) return { markdown, srcMap };
  return {
    markdown: replaceMarkdownImageSrcs(markdown, (src) => dataUrls.get(src) ?? src),
    srcMap,
  };
}
