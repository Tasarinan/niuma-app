/** Bound co-creation manuscript: chat injects it, 编辑 opens it. */

import {
  displayPathUnderDrafts,
  isOpenableDraftMarkdown,
  requireOpenableDraftMarkdown,
  sameManuscriptPath,
  toDraftArticlePath,
} from "./drafts";
import { resolveWorkspacePath } from "./workspace-path";

export function isBindableDraftMarkdown(path: string): boolean {
  if (!isOpenableDraftMarkdown(path)) return false;
  return /\/(article|topic|review)\.md$/i.test(path.replace(/\\/g, "/"));
}

export function locateDraftMarkdownPath(workspaceRoot: string, path: string): string {
  const resolved = workspaceRoot.trim() ? resolveWorkspacePath(workspaceRoot, path) : path;
  return requireOpenableDraftMarkdown(resolved);
}

export function formatCurrentDraftContext(filePath: string): string {
  const display = displayPathUnderDrafts(filePath) ?? filePath;
  return [
    `[当前共创目录] ${filePath}`,
    `切换「对话 / 编辑」时打开这一篇（${display}）。`,
    "新建目录后必须 `open_article` 定位，或让用户在编辑栏「当前共创」下拉里改。",
  ].join("\n");
}

export function shouldOpenBoundDraft(currentPath: string | undefined, incomingPath: string): boolean {
  if (!isBindableDraftMarkdown(incomingPath)) return false;
  if (!currentPath) return true;
  return !sameManuscriptPath(toDraftArticlePath(currentPath), toDraftArticlePath(incomingPath));
}

export function currentDraftPickerOptions(
  drafts: Array<{ folder: string; title: string; articlePath?: string; topicPath?: string }>,
): Array<{ value: string; label: string }> {
  return drafts
    .map((draft) => {
      const value = draft.articlePath ?? draft.topicPath ?? "";
      return value ? { value, label: `${draft.folder} · ${draft.title}` } : null;
    })
    .filter((option): option is { value: string; label: string } => option != null);
}
