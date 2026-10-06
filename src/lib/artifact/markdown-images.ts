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

/** Unique editor `src` for a data URL so identical bytes still map to different `imgs/` paths on save. */
export function editorImageDisplaySrc(dataUrl: string, relativePath: string): string {
  const rel = relativePath.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!dataUrl || dataUrl.includes("#")) return dataUrl;
  return `${dataUrl}#${encodeURIComponent(rel)}`;
}

export function registerEditorImageSrc(
  srcMap: Map<string, string>,
  dataUrl: string,
  relativePath: string,
): string {
  const rel = relativePath.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  const disk = /^imgs\//i.test(rel) ? rel : `imgs/${rel.replace(/^imgs\//i, "")}`;
  const displaySrc = editorImageDisplaySrc(dataUrl, disk);
  srcMap.set(displaySrc, disk);
  return displaySrc;
}

export function lookupMappedImageSrc(src: string, srcMap: Map<string, string>): string | undefined {
  if (srcMap.has(src)) return srcMap.get(src);
  const hash = src.indexOf("#");
  if (hash > 0) {
    const base = src.slice(0, hash);
    if (srcMap.has(base)) return srcMap.get(base);
  }
  let decoded = src;
  try {
    decoded = decodeURIComponent(src);
  } catch {
    // keep original
  }
  if (decoded !== src && srcMap.has(decoded)) return srcMap.get(decoded);
  const compact = decoded.replace(/\s/g, "");
  for (const [displaySrc, original] of srcMap) {
    const displayBase = displaySrc.split("#")[0]?.replace(/\s/g, "") ?? "";
    if (displayBase && displayBase === compact.split("#")[0]) return original;
  }
  return undefined;
}

/** When alt is already `workbuddy-07.png` but src wrongly points elsewhere, fix the link. */
export function repairMarkdownImageSrcFromAlt(markdown: string): string {
  return replaceMarkdownImageSrcs(markdown, (src, alt) => {
    const file = alt.trim().replace(/^.*[\\/]/, "");
    if (!file) return src;
    const ok =
      /^cover\.png$/i.test(file) ||
      /^\d{2}\.png$/i.test(file) ||
      /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{2}\.png$/i.test(file);
    if (!ok) return src;
    const expected = `imgs/${file}`;
    const current = src.trim().replace(/\\/g, "/").replace(/^\.\//, "");
    return current === expected ? src : expected;
  });
}

function preferredMarkdownImageRelative(
  markdownSrc: string,
  resolvedAbs: string,
  _articleFilePath: string,
  taken: string[],
  themeSlug?: string,
): string {
  const normalizedSrc = markdownSrc.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (/^imgs\/[^/]+\.png$/i.test(normalizedSrc)) {
    return normalizedSrc;
  }
  const abs = resolvedAbs.replace(/\\/g, "/");
  if (/\/imgs\/[^/]+\.png$/i.test(abs)) {
    const file = abs.slice(abs.lastIndexOf("/") + 1);
    return `imgs/${file}`;
  }
  return toImgsMarkdownSrc(markdownSrc, taken, {
    themeSlug,
    intent: inferImageNameIntent(markdownSrc),
  });
}

export function relativizeMarkdownImages(markdown: string, srcMap: Map<string, string>): string {
  if (srcMap.size === 0) return markdown;
  return replaceMarkdownImageSrcs(markdown, (src) => lookupMappedImageSrc(src, srcMap) ?? src);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function displaySrcForImageBytes(
  bytes: Uint8Array,
  mime: string,
  relative: string,
  toDisplaySrc?: (absPath: string, markdownSrc: string) => string,
  absPath?: string,
  markdownSrc?: string,
): string {
  if (toDisplaySrc && absPath && markdownSrc) {
    return toDisplaySrc(absPath, markdownSrc);
  }
  if (typeof URL !== "undefined" && typeof Blob !== "undefined") {
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  }
  const dataUrl = `data:${mime};base64,${btoa(String.fromCharCode(...bytes))}`;
  return editorImageDisplaySrc(dataUrl, relative);
}

export async function inlineLocalMarkdownImages(
  markdown: string,
  articleFilePath: string | undefined,
  readBase64: (path: string) => Promise<string>,
  toDisplaySrc?: (absPath: string, markdownSrc: string) => string,
): Promise<{ markdown: string; srcMap: Map<string, string>; objectUrls: string[] }> {
  const srcMap = new Map<string, string>();
  const objectUrls: string[] = [];
  if (!articleFilePath || !markdownHasUnresolvedLocalImages(markdown)) {
    return { markdown, srcMap, objectUrls };
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
        const mime = imageMimeFromPath(candidate);
        const bytes = base64ToBytes(base64);
        const relative = preferredMarkdownImageRelative(src, candidate, articleFilePath, taken, themeSlug);
        taken.push(relative.replace(/^imgs\//i, ""));
        const displaySrc = displaySrcForImageBytes(
          bytes,
          mime,
          relative,
          toDisplaySrc,
          candidate,
          src,
        );
        if (displaySrc.startsWith("blob:")) objectUrls.push(displaySrc);
        dataUrls.set(src, displaySrc);
        srcMap.set(displaySrc, relative);
        return;
      }
    }),
  );

  if (dataUrls.size === 0) return { markdown, srcMap, objectUrls };
  return {
    markdown: replaceMarkdownImageSrcs(markdown, (src) => dataUrls.get(src) ?? src),
    srcMap,
    objectUrls,
  };
}
