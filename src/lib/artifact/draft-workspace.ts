/** One confirmed draft folder is the "project"; humans and agents edit the same files. */

import { normalizeDraftPath, resolveOpenDraftPath } from "./drafts";
import { formatCurrentDraftContext } from "./current-draft";
import { nextWechatImageFilename, type DraftImageNameIntent } from "./draft-image-names";
import { preferPngImageEntries, toDraftImgsAbsPath } from "./png-images";
import { imageMimeFromPath, normalizeFsPath } from "./workspace-path";

export type DraftFileKind = "article" | "topic" | "review" | "image" | "other";

export type BufferSyncState = "in-sync" | "apply-disk" | "human-dirty" | "conflict";

const DRAFTS_MARKER = ".artifacts/drafts/";

export function draftFolderFromFilePath(filePath: string): string | null {
  const normalized = normalizeDraftPath(filePath);
  const index = normalized.toLowerCase().indexOf(DRAFTS_MARKER);
  if (index < 0) return null;
  const rest = normalized.slice(index + DRAFTS_MARKER.length);
  const folder = rest.split("/").filter(Boolean)[0];
  if (!folder) return null;
  return normalized.slice(0, index + DRAFTS_MARKER.length + folder.length);
}

export function classifyDraftFile(name: string): DraftFileKind {
  if (/^article\.md$/i.test(name)) return "article";
  if (/^topic\.md$/i.test(name)) return "topic";
  if (/^review\.md$/i.test(name)) return "review";
  if (/\.(png|jpe?g|jfif|gif|webp|svg)$/i.test(name)) return "image";
  return "other";
}

export function classifyBufferSync(input: {
  editorContent: string;
  diskContent: string;
  lastSavedContent: string;
}): BufferSyncState {
  const editor = input.editorContent;
  const disk = input.diskContent;
  const saved = input.lastSavedContent;
  if (editor === disk) return "in-sync";
  if (editor === saved && disk !== saved) return "apply-disk";
  if (editor !== saved && disk === saved) return "human-dirty";
  return "conflict";
}

/** Decide whether an external/agent disk write should reload the open editor. */
export function resolveDiskSyncAction(input: {
  humanEdited: boolean;
  editorContent: string;
  diskContent: string;
  lastSavedContent: string;
}): "apply-disk" | "keep" | "conflict" {
  const state = classifyBufferSync(input);
  if (state === "in-sync") return "keep";
  if (!input.humanEdited && input.diskContent !== input.lastSavedContent) {
    return "apply-disk";
  }
  if (state === "apply-disk") return "apply-disk";
  if (state === "conflict") return "conflict";
  return "keep";
}

/** Prefer the in-memory buffer when reopening a manuscript the human already edited. */
export function pickOpenManuscriptContent(input: {
  diskContent: string;
  memoryContent?: string;
  lastSavedContent?: string;
}): string {
  if (input.memoryContent == null) return input.diskContent;
  const state = classifyBufferSync({
    editorContent: input.memoryContent,
    diskContent: input.diskContent,
    lastSavedContent: input.lastSavedContent ?? "",
  });
  if (state === "human-dirty" || state === "conflict") return input.memoryContent;
  return input.diskContent;
}

export function formatOpenDraftContext(filePath: string): string {
  return formatCurrentDraftContext(filePath);
}

/** Remove hidden manuscript context from a visible chat / history string. */
export function stripHiddenDraftContext(text: string): string {
  const markers = ["[今天]", "[当前共创目录]", "[当前打开的文稿]"];
  let cut = -1;
  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index >= 0 && (cut < 0 || index < cut)) cut = index;
  }
  if (cut < 0) return text;
  return text.slice(0, cut).replace(/\s+$/u, "").trimEnd();
}

/** Hidden agent context only — do not put this in the visible chat bubble. */
export function injectOpenDraftContext(
  agentInput: string,
  options: { sidecar?: boolean; openFilePath?: string; lastOpenPath?: string },
): string {
  const path = resolveOpenDraftPath(options.openFilePath, options.lastOpenPath);
  if (!path) return agentInput;
  return `${agentInput}\n\n${formatOpenDraftContext(path)}`;
}

export const DRAFT_FILE_ORDER: DraftFileKind[] = ["article", "topic", "review", "image", "other"];

export function sortDraftFiles<T extends { name: string }>(files: T[]): T[] {
  return [...files].sort((left, right) => {
    const kindDelta =
      DRAFT_FILE_ORDER.indexOf(classifyDraftFile(left.name)) -
      DRAFT_FILE_ORDER.indexOf(classifyDraftFile(right.name));
    if (kindDelta !== 0) return kindDelta;
    return left.name.localeCompare(right.name, "zh");
  });
}

export interface DraftWorkspaceFile {
  name: string;
  path: string;
  kind: DraftFileKind;
}

export async function loadDraftWorkspaceFiles(openFilePath: string): Promise<DraftWorkspaceFile[]> {
  const folder = draftFolderFromFilePath(openFilePath);
  if (!folder) return [];
  const { listDirectory } = await import("./fs");
  const top = await listDirectory(folder).catch(() => []);
  const files: DraftWorkspaceFile[] = [];
  for (const entry of top) {
    if (!entry.isDir) {
      files.push({ name: entry.name, path: entry.path, kind: classifyDraftFile(entry.name) });
      continue;
    }
    if (!/^imgs$/i.test(entry.name) && !/^assets$/i.test(entry.name)) continue;
    const nested = await listDirectory(entry.path).catch(() => []);
    for (const child of nested) {
      if (!child.isDir) {
        files.push({
          name: `${entry.name}/${child.name}`,
          path: child.path,
          kind: classifyDraftFile(child.name) === "image" ? "image" : "other",
        });
        continue;
      }
      const nested2 = await listDirectory(child.path).catch(() => []);
      for (const grandchild of nested2.filter((item) => !item.isDir)) {
        files.push({
          name: `${entry.name}/${child.name}/${grandchild.name}`,
          path: grandchild.path,
          kind: classifyDraftFile(grandchild.name) === "image" ? "image" : "other",
        });
      }
    }
  }
  return sortDraftFiles(files).filter((file) => file.kind !== "other" || /\.md$/i.test(file.name));
}

export interface DraftImagePrompt {
  title: string;
  filename?: string;
  prompt: string;
}

const IMAGE_FILE_RE = /[^/\\:*?"<>|]+\.(?:png|jpe?g|jfif|gif|webp)/i;

export function draftImageStem(name: string): string {
  return name.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "").toLowerCase();
}

export function isIgnoredPromptDump(fileName: string): boolean {
  return /^backup\.md$/i.test(fileName.replace(/^.*[\\/]/, ""));
}

export function promptMarkdownAbsPath(imageAbsPath: string): string {
  const png = toDraftImgsAbsPath(imageAbsPath).replace(/\\/g, "/");
  const dir = png.slice(0, png.lastIndexOf("/"));
  return `${dir}/prompts/${draftImageStem(png)}.md`;
}

export function formatDraftImagePromptMarkdown(input: {
  title: string;
  filename: string;
  prompt: string;
  sourceUrl?: string;
}): string {
  const file = input.filename.replace(/^.*[\\/]/, "");
  const title = input.title.trim() || draftImageStem(file);
  const source = input.sourceUrl?.trim();
  const sourceBlock = source ? `\n\n**来源**：\n${source}\n` : "\n";
  return `# ${title}（${file}）\n\n**中文提示词**：\n${input.prompt.trim()}${sourceBlock}`;
}

function promptTextFromSection(section: string): string {
  const chinese = section.match(/\*\*中文提示词\*\*[：:]\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*##|$)/);
  const keywords = section.match(/\*\*风格关键词\*\*[：:]\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*##|$)/);
  if (chinese?.[1]?.trim()) return chinese[1].trim();
  if (keywords?.[1]?.trim()) return keywords[1].trim();
  const body = section.replace(/^.*\r?\n/, "").trim();
  if (!body.includes("**")) return body;
  return "";
}

export function parseImagePromptBlocks(markdown: string): DraftImagePrompt[] {
  const sections = markdown.split(/^##\s+/m).slice(1);
  const blocks: DraftImagePrompt[] = [];
  for (const section of sections) {
    const headingLine = section.split(/\r?\n/, 1)[0]?.trim() ?? "";
    const parenFile = headingLine.match(new RegExp(`[（(](${IMAGE_FILE_RE.source})[）)]`, "i"));
    const headingFile = headingLine.match(new RegExp(`^(${IMAGE_FILE_RE.source})$`, "i"));
    const filename = parenFile?.[1] ?? headingFile?.[1];
    const title = headingFile
      ? draftImageStem(headingFile[1])
      : headingLine.replace(/[（(][^）)]+[）)]/g, "").trim();
    const prompt = promptTextFromSection(section);
    if (!title && !prompt) continue;
    blocks.push({
      title: title || "配图",
      filename,
      prompt,
    });
  }
  return blocks;
}

/** One markdown file belongs to one image: `imgs/prompts/cover.md` → `cover.png`. */
export function parseImagePromptFile(markdown: string, fileName: string): DraftImagePrompt | null {
  if (isIgnoredPromptDump(fileName)) return null;
  const stem = draftImageStem(fileName);
  if (!stem) return null;
  const filename = `${stem}.png`;
  const blocks = parseImagePromptBlocks(markdown);
  const matched =
    blocks.find((block) => block.filename && draftImageStem(block.filename) === stem) ??
    (blocks.length === 1 ? blocks[0] : undefined);
  const prompt = matched?.prompt || (blocks.length === 0 ? promptTextFromSection(`\n${markdown}`) : "");
  if (!prompt) return null;
  const h1 = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
  const h1Title = h1.replace(/[（(][^）)]+[）)]/g, "").trim();
  const title =
    (matched?.title && matched.title.toLowerCase() !== filename.toLowerCase()
      ? matched.title
      : h1Title) || stem;
  return { title, filename, prompt };
}

export function pairDraftImagePrompts(
  imageNames: string[],
  promptFiles: { name: string; markdown: string }[],
): { byImage: Map<string, DraftImagePrompt>; unmatched: DraftImagePrompt[] } {
  const byStem = new Map<string, DraftImagePrompt>();
  for (const file of promptFiles) {
    const parsed = parseImagePromptFile(file.markdown, file.name);
    if (!parsed) continue;
    byStem.set(draftImageStem(file.name), parsed);
  }
  const byImage = new Map<string, DraftImagePrompt>();
  const used = new Set<string>();
  for (const name of imageNames) {
    const stem = draftImageStem(name);
    const prompt = byStem.get(stem);
    if (!prompt) continue;
    byImage.set(name, prompt);
    used.add(stem);
  }
  const unmatched: DraftImagePrompt[] = [];
  for (const [stem, prompt] of byStem) {
    if (used.has(stem)) continue;
    unmatched.push(prompt);
  }
  return { byImage, unmatched };
}

export function nextDraftImageFilename(
  existingNames: string[],
  options: { intent?: DraftImageNameIntent; themeSlug?: string } = {},
): string {
  const intent = options.intent ?? "inline";
  const names = existingNames.map((name) => name.replace(/^.*\//, "").toLowerCase());
  if (intent === "cover" && !names.some((name) => /^cover\.(png|jpe?g|jfif|gif|webp)$/i.test(name))) {
    return "cover.png";
  }
  return nextWechatImageFilename(names, options.themeSlug);
}

export interface DraftGalleryItem {
  id: string;
  title: string;
  name: string;
  relativeSrc?: string;
  path?: string;
  dataUrl?: string;
  prompt: string;
}

export function sortDraftGalleryItems(items: DraftGalleryItem[]): DraftGalleryItem[] {
  const rank = (item: DraftGalleryItem) => {
    const rel = (item.relativeSrc || item.name).replace(/\\/g, "/");
    const underImgs = rel.toLowerCase().startsWith("imgs/");
    const cover = /(^|\/)(cover|封面)\./i.test(rel) || /封面/.test(item.title);
    return {
      underImgs: underImgs ? 0 : 1,
      cover: cover ? 0 : 1,
      rel: rel.toLowerCase(),
    };
  };
  return [...items].sort((a, b) => {
    const left = rank(a);
    const right = rank(b);
    if (left.underImgs !== right.underImgs) return left.underImgs - right.underImgs;
    if (left.cover !== right.cover) return left.cover - right.cover;
    return left.rel.localeCompare(right.rel, "zh");
  });
}

export function assembleDraftGalleryItems(input: {
  images: { name: string; path: string; relativeSrc: string; dataUrl?: string }[];
  promptDocs: { name: string; markdown: string }[];
}): DraftGalleryItem[] {
  const images = preferPngImageEntries(input.images);
  const paired = pairDraftImagePrompts(
    images.map((image) => image.name),
    input.promptDocs,
  );
  const items: DraftGalleryItem[] = [];
  for (const image of images) {
    const prompt = paired.byImage.get(image.name);
    items.push({
      id: image.path,
      title: prompt?.title || image.name,
      name: image.name,
      relativeSrc: image.relativeSrc,
      path: image.path,
      dataUrl: image.dataUrl,
      prompt: prompt?.prompt ?? "",
    });
  }
  for (const prompt of paired.unmatched) {
    items.push({
      id: `prompt:${prompt.filename}`,
      title: prompt.title,
      name: prompt.filename || nextDraftImageFilename(items.map((item) => item.name)),
      relativeSrc: prompt.filename ? `imgs/${prompt.filename}` : undefined,
      prompt: prompt.prompt,
    });
  }
  return sortDraftGalleryItems(items);
}

export async function loadDraftImageGallery(openFilePath: string): Promise<DraftGalleryItem[]> {
  const folder = draftFolderFromFilePath(openFilePath);
  if (!folder) return [];
  const { listDirectory, readText, readBinaryBase64 } = await import("./fs");
  const root = normalizeFsPath(folder).replace(/\/$/, "");
  const imageEntries: { name: string; path: string; relativeSrc: string; dataUrl?: string }[] = [];
  const promptDocs: { name: string; markdown: string }[] = [];

  const walk = async (dir: string, relPrefix: string, inPrompts: boolean) => {
    const entries = relPrefix
      ? await listDirectory(dir).catch(() => [])
      : await listDirectory(dir);
    for (const entry of entries) {
      const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      if (entry.isDir) {
        await walk(entry.path, rel, inPrompts || /^prompts$/i.test(entry.name));
        continue;
      }
      if (inPrompts && /\.md$/i.test(entry.name)) {
        promptDocs.push({
          name: entry.name,
          markdown: await readText(entry.path).catch(() => ""),
        });
        continue;
      }
      if (classifyDraftFile(entry.name) === "image") {
        imageEntries.push({ name: entry.name, path: entry.path, relativeSrc: rel });
      }
    }
  };
  await walk(root, "", false);

  for (const image of imageEntries) {
    const base64 = await readBinaryBase64(image.path).catch(() => "");
    image.dataUrl = base64 ? `data:${imageMimeFromPath(image.name)};base64,${base64}` : undefined;
  }

  return assembleDraftGalleryItems({ images: imageEntries, promptDocs });
}
