/** Shared on-disk layout for content-team drafts. Humans and agents both edit article.md. */

import { topicNotConfirmedMessage } from "@/lib/content/roster-workflow";

export const CONTENT_DRAFTS_DIR = ".artifacts/drafts";
export const DRAFT_ARTICLE_FILENAME = "article.md";

const DATED_PREFIX = /^(\d{8})-(.+)$/;

export function toDraftDatePrefix(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/** Hidden agent context: real local date, so models do not copy skill examples. */
export function formatDraftTodayContext(date: Date = new Date()): string {
  const yyyymmdd = toDraftDatePrefix(date);
  return `[今天] ${yyyymmdd}\n新建草稿目录必须用这个日期前缀：${CONTENT_DRAFTS_DIR}/${yyyymmdd}-主题/。同一主题当天只准一个目录；措辞差一两个字（很难/难）也要沿用已有目录，不要再 mkdir。禁止抄技能示例或其它日期。`;
}

export function injectDraftTodayContext(agentInput: string, date: Date = new Date()): string {
  return `${agentInput}\n\n${formatDraftTodayContext(date)}`;
}

export function toTopicSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "untitled"
  );
}

/** Compare theme folder names ignoring filler words so 难 / 很难 stay one draft. */
export function collapseThemeKey(value: string): string {
  return toTopicSlug(value)
    .replace(/^\d{8}-/, "")
    .replace(/[，。！？、,.!?:；;]/g, "")
    .replace(/走向/g, "到")
    .replace(/走到/g, "到")
    .replace(/[很的地得了着过]/g, "");
}

export function isSameDraftTheme(left: string, right: string): boolean {
  const a = collapseThemeKey(left);
  const b = collapseThemeKey(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a));
}

export function findReusableDraftSlug(
  existingFolders: string[],
  theme: string,
  date: Date = new Date(),
): string | undefined {
  const prefix = `${toDraftDatePrefix(date)}-`;
  const today = existingFolders.filter((folder) => folder.startsWith(prefix));
  return today.find((folder) => isSameDraftTheme(folder, theme));
}

export function extractDraftFolderName(path: string): string | undefined {
  const normalized = normalizeDraftPath(path);
  const marker = `${CONTENT_DRAFTS_DIR}/`;
  const index = normalized.toLowerCase().indexOf(marker);
  if (index >= 0) {
    return normalized.slice(index + marker.length).split("/").filter(Boolean)[0];
  }
  return normalized.match(/(?:^|\/)(\d{8}-[^/]+)/)?.[1];
}

export function resolveLockedDraftFolder(
  theme: string,
  existingFolders: string[],
  date: Date = new Date(),
): { folder: string; reused: boolean } {
  const reused = findReusableDraftSlug(existingFolders, theme, date);
  if (reused) return { folder: reused, reused: true };
  return { folder: toDraftSlug(theme, date), reused: false };
}

function preferredSameThemeFolder(
  folder: string,
  existingFolders: string[],
  date: Date,
  preferredFolder?: string,
): string | undefined {
  const prefix = `${toDraftDatePrefix(date)}-`;
  if (
    preferredFolder &&
    preferredFolder.startsWith(prefix) &&
    existingFolders.includes(preferredFolder) &&
    isSameDraftTheme(preferredFolder, folder) &&
    preferredFolder !== folder
  ) {
    return preferredFolder;
  }
  const locked = findReusableDraftSlug(existingFolders, folder, date);
  return locked && locked !== folder ? locked : undefined;
}

export function redirectDraftWritePath(
  requestedPath: string,
  existingFolders: string[],
  date: Date = new Date(),
  preferredFolder?: string,
): { path: string; redirectedFrom?: string } {
  const folder = extractDraftFolderName(requestedPath);
  if (!folder) return { path: requestedPath };
  const locked = preferredSameThemeFolder(folder, existingFolders, date, preferredFolder);
  if (!locked) return { path: requestedPath };
  return { path: requestedPath.replaceAll(folder, locked), redirectedFrom: folder };
}

export function rewriteDraftFoldersInCommand(
  command: string,
  existingFolders: string[],
  date: Date = new Date(),
  preferredFolder?: string,
): string {
  return command.replace(/(?:\.artifacts\/drafts\/)?(\d{8}-[^\s"'\\/]+)/g, (matched, folder: string) => {
    const locked = preferredSameThemeFolder(folder, existingFolders, date, preferredFolder);
    if (!locked) return matched;
    return matched.replaceAll(folder, locked);
  });
}

/** Folder name: YYYYMMDD-topic, e.g. 20260903-ai-agent-productization */
export function toDraftSlug(title: string, date: Date = new Date()): string {
  const trimmed = title.trim();
  const dated = trimmed.match(DATED_PREFIX);
  if (dated) return `${dated[1]}-${toTopicSlug(dated[2])}`;
  return `${toDraftDatePrefix(date)}-${toTopicSlug(title)}`;
}

export function relativeDraftArticlePath(title: string, date: Date = new Date()): string {
  return `${toDraftSlug(title, date)}/${DRAFT_ARTICLE_FILENAME}`;
}

export function isDraftArticleFile(relativeOrAbsolutePath: string): boolean {
  const normalized = relativeOrAbsolutePath.replace(/\\/g, "/");
  return (
    normalized === DRAFT_ARTICLE_FILENAME ||
    normalized.endsWith(`/${DRAFT_ARTICLE_FILENAME}`)
  );
}

/** Editor/app may only write into a folder that already exists after topic confirm. */
export function requireConfirmedDraftPath(
  existingPath?: string,
  copy?: { draftCommand?: string; hostName?: string },
): string {
  if (!existingPath) {
    throw new Error(topicNotConfirmedMessage(copy));
  }
  return existingPath;
}

/** Strip Windows `\\?\` prefixes and repair a missing slash before `.artifacts`. */
export function normalizeDraftPath(path: string): string {
  let value = path.trim();
  if (!value) return value;
  if (value.startsWith("\\\\?\\UNC\\")) value = `\\\\${value.slice(8)}`;
  else if (value.startsWith("\\\\?\\")) value = value.slice(4);
  else if (value.startsWith("//?/")) value = value.slice(4);
  else if (value.startsWith("\\?\\")) value = value.slice(3);
  value = value.replace(/\\/g, "/");
  value = value.replace(/([A-Za-z0-9_-])\.artifacts\//gi, "$1/.artifacts/");
  value = value.replace(/\/+/g, "/");
  return value;
}

export function isOpenableDraftMarkdown(path: string): boolean {
  const normalized = normalizeDraftPath(path).toLowerCase();
  if (!normalized.includes(`${CONTENT_DRAFTS_DIR}/`)) return false;
  return normalized.endsWith(".md");
}

/** Folder + filename under `.artifacts/drafts/`, e.g. `20260903-topic/article.md`. */
export function displayPathUnderDrafts(filePath?: string): string | null {
  if (!filePath) return null;
  const normalized = normalizeDraftPath(filePath);
  const marker = `${CONTENT_DRAFTS_DIR}/`;
  const index = normalized.toLowerCase().indexOf(marker);
  if (index < 0) return null;
  const relative = normalized.slice(index + marker.length).replace(/^\/+/, "");
  return relative || null;
}

export function toDraftArticlePath(path: string): string {
  const normalized = normalizeDraftPath(path);
  const marker = `${CONTENT_DRAFTS_DIR}/`;
  const index = normalized.toLowerCase().indexOf(marker);
  if (index < 0) return normalized;
  const after = normalized.slice(index + marker.length);
  const folder = after.split("/").filter(Boolean)[0];
  if (!folder) return normalized;
  return `${normalized.slice(0, index + marker.length)}${folder}/${DRAFT_ARTICLE_FILENAME}`;
}

export function isManuscriptArticlePath(path: string): boolean {
  return /\/article\.md$/i.test(normalizeDraftPath(path));
}

/** True when two paths point at the same draft article.md (slash/case insensitive). */
export function sameManuscriptPath(left?: string, right?: string): boolean {
  if (!left || !right) return false;
  return toDraftArticlePath(left).toLowerCase() === toDraftArticlePath(right).toLowerCase();
}

/** localStorage key for the last draft the editor actually opened. */
export const LAST_OPEN_DRAFT_KEY = "niuma.artifact.lastOpenPath";

/**
 * Chat/editor must not bind leftover files such as
 * Documents/niuma/artifact/untitled-article.md.
 */
export function resolveOpenDraftPath(
  openFilePath?: string,
  lastOpenPath?: string,
): string | undefined {
  if (openFilePath && isOpenableDraftMarkdown(openFilePath)) {
    return toDraftArticlePath(openFilePath);
  }
  if (lastOpenPath && isOpenableDraftMarkdown(lastOpenPath)) {
    return toDraftArticlePath(lastOpenPath);
  }
  return undefined;
}

export function requireOpenableDraftMarkdown(path?: string): string {
  const existing = requireConfirmedDraftPath(path);
  if (!isOpenableDraftMarkdown(existing)) {
    throw new Error("只能打开已确认选题目录下的 Markdown（article.md / topic.md / review.md）。");
  }
  return normalizeDraftPath(existing);
}
