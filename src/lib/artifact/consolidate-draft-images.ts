/**
 * Move draft-folder images into `imgs/*.png` with themed WeChat-safe names
 * and rewrite Markdown so `alt` matches the on-disk filename.
 */

import {
  draftThemeSlugFromFolder,
  inferImageNameIntent,
  isWechatSafeImageFilename,
  nextWechatImageFilename,
  type DraftImageNameIntent,
} from "./draft-image-names";
import { classifyDraftFile, draftFolderFromFilePath } from "./draft-workspace";
import type { SimpleDirEntry } from "./fs/fs.type";
import {
  collectMarkdownImageSrcs,
  isRemoteOrDataImageSrc,
  localImageReadCandidates,
  resolveLocalImagePath,
} from "./markdown-images";
import { ensurePngBytes, isRasterImagePath } from "./png-images";
import { normalizeFsPath } from "./workspace-path";

const DRAFT_MARKDOWN = /^article\.md$|^topic\.md$|^review\.md$/i;

export interface ConsolidateDraftImagesResult {
  articlePath: string;
  folder: string;
  themeSlug: string;
  written: string[];
  removed: string[];
  updatedMarkdown: string[];
  mappings: { from: string; to: string }[];
}

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() || path;
}

function imgsRel(name: string): string {
  return `imgs/${name.replace(/^imgs\//i, "")}`;
}

function isUnderDraftImgs(absPath: string, folder: string): boolean {
  const normalized = normalizeFsPath(absPath).toLowerCase();
  const imgsRoot = `${normalizeFsPath(folder).replace(/\/$/, "")}/imgs/`.toLowerCase();
  return normalized.startsWith(imgsRoot);
}

function isDraftRootRaster(absPath: string, folder: string): boolean {
  const normalized = normalizeFsPath(absPath);
  const draftRoot = normalizeFsPath(folder).replace(/\/$/, "");
  if (!normalized.startsWith(`${draftRoot}/`)) return false;
  const rest = normalized.slice(draftRoot.length + 1);
  if (!rest || rest.includes("/")) return false;
  return classifyDraftFile(basename(normalized)) === "image";
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function resolveReadableImageAbs(
  articlePath: string,
  src: string,
  readBase64: (path: string) => Promise<string>,
): Promise<string | null> {
  const abs = resolveLocalImagePath(articlePath, src);
  if (!abs) return null;
  for (const candidate of localImageReadCandidates(abs)) {
    const base64 = await readBase64(candidate).catch(() => "");
    if (base64) return normalizeFsPath(candidate);
  }
  return null;
}

async function listRasterImagesInDraft(
  folder: string,
  listDirectory: (path: string) => Promise<SimpleDirEntry[]>,
): Promise<string[]> {
  const normalized = normalizeFsPath(folder).replace(/\/$/, "");
  const top = await listDirectory(normalized).catch(() => []);
  const paths: string[] = [];
  for (const entry of top) {
    if (!entry.isDir && classifyDraftFile(entry.name) === "image") {
      paths.push(normalizeFsPath(entry.path));
    }
    if (entry.isDir && /^imgs$/i.test(entry.name)) {
      const nested = await listDirectory(entry.path).catch(() => []);
      for (const child of nested) {
        if (!child.isDir && classifyDraftFile(child.name) === "image") {
          paths.push(normalizeFsPath(child.path));
        }
      }
    }
  }
  return paths;
}

const MD_IMAGE = /!\[([^\]]*)\]\(([^)]*)\)/g;

export function rewriteMarkdownImageRefsAligned(
  markdown: string,
  mapSrc: (src: string, alt: string) => { src: string; alt: string } | null,
): string {
  return markdown.replace(MD_IMAGE, (_all, alt: string, inner: string) => {
    const src = parseMarkdownImageTarget(inner ?? "");
    const next = mapSrc(src, alt);
    if (!next) return _all;
    const title = inner.trim().slice(src.length).trim();
    const suffix = title ? ` ${title}` : "";
    return `![${next.alt}](${next.src}${suffix})`;
  });
}

function parseMarkdownImageTarget(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return trimmed.slice(1, -1).trim();
  }
  const quoted = trimmed.match(/^(.+?)\s+(?:"[^"]*"|'[^']*')\s*$/);
  return (quoted?.[1] ?? trimmed).trim();
}

function assignThemedPngName(
  taken: string[],
  themeSlug: string,
  intent: DraftImageNameIntent,
): string {
  if (intent === "cover" && !taken.some((name) => /^cover\.png$/i.test(name))) {
    taken.push("cover.png");
    return "cover.png";
  }
  const name = nextWechatImageFilename(taken, themeSlug);
  taken.push(name);
  return name;
}

function shouldReassignExistingImgsName(fileName: string, themeSlug: string): boolean {
  if (!themeSlug) return false;
  if (/^cover\.png$/i.test(fileName)) return false;
  if (/^\d{2}\.png$/i.test(fileName)) return true;
  if (!isWechatSafeImageFilename(fileName)) return true;
  const stem = fileName.replace(/\.png$/i, "");
  if (!stem.startsWith(`${themeSlug}-`)) return true;
  return false;
}

export async function consolidateDraftImages(input: {
  articlePath: string;
  readText: (path: string) => Promise<string>;
  writeText: (path: string, content: string) => Promise<void>;
  readBase64: (path: string) => Promise<string>;
  writeBytes: (path: string, bytes: Uint8Array) => Promise<void>;
  listDirectory: (path: string) => Promise<SimpleDirEntry[]>;
  removeFile?: (path: string) => Promise<void>;
  encodePng?: (bytes: Uint8Array) => Promise<Uint8Array>;
}): Promise<ConsolidateDraftImagesResult> {
  const articlePath = normalizeFsPath(input.articlePath);
  const folder = draftFolderFromFilePath(articlePath);
  if (!folder) {
    throw new Error("只能整理 .niuma/artifacts/drafts/<主题>/ 下的稿件。");
  }
  const themeSlug = draftThemeSlugFromFolder(folder);
  const encodePng = input.encodePng ?? ensurePngBytes;

  const markdownPaths: string[] = [];
  const top = await input.listDirectory(folder).catch(() => []);
  for (const entry of top) {
    if (!entry.isDir && DRAFT_MARKDOWN.test(entry.name)) {
      markdownPaths.push(normalizeFsPath(entry.path));
    }
  }
  if (!markdownPaths.some((path) => /article\.md$/i.test(path))) {
    markdownPaths.unshift(`${normalizeFsPath(folder)}/article.md`);
  }

  const markdownByPath = new Map<string, string>();
  for (const path of markdownPaths) {
    markdownByPath.set(path, await input.readText(path).catch(() => ""));
  }

  const orderedAbs: string[] = [];
  const seenAbs = new Set<string>();
  for (const path of markdownPaths.sort((a, b) => {
    const rank = (value: string) => (/article\.md$/i.test(value) ? 0 : /topic\.md$/i.test(value) ? 1 : 2);
    return rank(a) - rank(b);
  })) {
    const md = markdownByPath.get(path) ?? "";
    for (const src of collectMarkdownImageSrcs(md)) {
      if (isRemoteOrDataImageSrc(src)) continue;
      const abs = await resolveReadableImageAbs(articlePath, src, input.readBase64);
      if (!abs || seenAbs.has(abs)) continue;
      seenAbs.add(abs);
      orderedAbs.push(abs);
    }
  }

  const allRaster = await listRasterImagesInDraft(folder, input.listDirectory);
  for (const abs of allRaster.sort((a, b) => basename(a).localeCompare(basename(b), "zh"))) {
    if (!seenAbs.has(abs)) {
      seenAbs.add(abs);
      orderedAbs.push(abs);
    }
  }

  const taken: string[] = [];
  const absToRel = new Map<string, string>();
  const mappings: { from: string; to: string }[] = [];

  const keepAbs: string[] = [];
  const reassignAbs: string[] = [];
  for (const abs of orderedAbs) {
    const fileName = basename(abs);
    const underImgs = /\/imgs\//i.test(abs);
    if (
      underImgs &&
      isWechatSafeImageFilename(fileName) &&
      !shouldReassignExistingImgsName(fileName, themeSlug)
    ) {
      keepAbs.push(abs);
    } else {
      reassignAbs.push(abs);
    }
  }

  for (const abs of keepAbs) {
    const destName = basename(abs).toLowerCase();
    if (taken.some((name) => name.toLowerCase() === destName)) continue;
    taken.push(destName);
    absToRel.set(abs, imgsRel(destName));
  }

  for (const abs of reassignAbs) {
    const fileName = basename(abs);
    const intent = inferImageNameIntent(fileName);
    const destName = assignThemedPngName(taken, themeSlug, intent);
    absToRel.set(abs, imgsRel(destName));
  }

  const written: string[] = [];
  for (const [abs, rel] of absToRel) {
    const destAbs = normalizeFsPath(`${folder}/${rel}`);
    if (normalizeFsPath(abs) === destAbs) {
      const base64 = await input.readBase64(abs).catch(() => "");
      if (!base64) continue;
      const bytes = decodeBase64(base64);
      const png = await encodePng(bytes);
      if (!/\.png$/i.test(abs)) {
        await input.writeBytes(destAbs, png);
        written.push(destAbs);
        mappings.push({ from: abs, to: destAbs });
      }
      continue;
    }

    let sourceBytes: Uint8Array | undefined;
    for (const candidate of localImageReadCandidates(abs)) {
      const base64 = await input.readBase64(candidate).catch(() => "");
      if (!base64) continue;
      sourceBytes = decodeBase64(base64);
      break;
    }
    if (!sourceBytes) continue;
    const png = await encodePng(sourceBytes);
    await input.writeBytes(destAbs, png);
    written.push(destAbs);
    mappings.push({ from: abs, to: destAbs });
  }

  const removed: string[] = [];
  const removeFile = input.removeFile ?? (async () => undefined);
  const pathsToRemove = new Set<string>();
  for (const [abs, rel] of absToRel) {
    const srcAbs = normalizeFsPath(abs);
    const destAbs = normalizeFsPath(`${folder}/${rel}`);
    if (srcAbs === destAbs) continue;
    pathsToRemove.add(srcAbs);
  }
  for (const abs of orderedAbs) {
    const srcAbs = normalizeFsPath(abs);
    if (!isDraftRootRaster(srcAbs, folder)) continue;
    const rel = absToRel.get(srcAbs);
    if (!rel) continue;
    const destAbs = normalizeFsPath(`${folder}/${rel}`);
    if (srcAbs !== destAbs) pathsToRemove.add(srcAbs);
  }
  for (const abs of orderedAbs) {
    const srcAbs = normalizeFsPath(abs);
    if (!isUnderDraftImgs(srcAbs, folder)) continue;
    const rel = absToRel.get(srcAbs);
    if (!rel) continue;
    const destAbs = normalizeFsPath(`${folder}/${rel}`);
    if (srcAbs !== destAbs) pathsToRemove.add(srcAbs);
    const fileName = basename(srcAbs);
    if (!/\.png$/i.test(fileName)) pathsToRemove.add(srcAbs);
  }
  for (const path of pathsToRemove) {
    await removeFile(path).catch(() => undefined);
    removed.push(path);
  }

  const srcToRel = new Map<string, string>();
  for (const [abs, rel] of absToRel) {
    srcToRel.set(normalizeFsPath(abs), rel);
    srcToRel.set(rel, rel);
    srcToRel.set(rel.replace(/^imgs\//i, ""), rel);
  }

  const mapMarkdown = (markdown: string): string =>
    rewriteMarkdownImageRefsAligned(markdown, (src, _alt) => {
      if (isRemoteOrDataImageSrc(src)) return null;
      const abs = resolveLocalImagePath(articlePath, src);
      if (abs) {
        for (const candidate of localImageReadCandidates(abs)) {
          const normalized = normalizeFsPath(candidate);
          const rel = absToRel.get(normalized);
          if (rel) {
            const alt = basename(rel);
            return { src: rel, alt };
          }
        }
      }
      const key = src.replace(/\\/g, "/").replace(/^\.\//, "");
      const rel =
        srcToRel.get(key) ??
        (key.startsWith("imgs/") ? srcToRel.get(key.replace(/^imgs\//i, "")) : undefined);
      if (!rel) return null;
      return { src: rel, alt: basename(rel) };
    });

  const updatedMarkdown: string[] = [];
  for (const path of markdownPaths) {
    const before = markdownByPath.get(path) ?? "";
    const after = mapMarkdown(before);
    if (after !== before) {
      await input.writeText(path, after);
      updatedMarkdown.push(path);
    }
  }

  return {
    articlePath,
    folder: normalizeFsPath(folder),
    themeSlug,
    written,
    removed,
    updatedMarkdown,
    mappings,
  };
}

export function isConsolidatableRasterPath(path: string): boolean {
  return isRasterImagePath(path);
}
