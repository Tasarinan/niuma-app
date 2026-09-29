/** In-progress WeChat drafts that were confirmed but not published yet. */

import { isManuscriptArticlePath, isOpenableDraftMarkdown, toDraftArticlePath } from "./drafts";
import { draftFolderFromFilePath } from "./draft-workspace";

export interface UnpublishedDraft {
  folder: string;
  title: string;
  dirPath: string;
  articlePath?: string;
  topicPath?: string;
  hasReview: boolean;
  hasImages: boolean;
}

export function isPublishedMarker(fileName: string): boolean {
  return /^(published\.(md|json)|\.published)$/i.test(fileName.trim());
}

export function titleFromTopicOrFolder(topicMarkdown: string | undefined, folder: string): string {
  const heading = topicMarkdown?.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  return folder.replace(/^\d{8}-/, "") || folder;
}

export function isPlaceholderArticleTitle(title: string | undefined): boolean {
  return !title?.trim() || /^(untitled|untitled article|未命名文章|article|topic)$/i.test(title.trim());
}

export function displayTitleForDraftFile(filePath: string, content: string): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  const folder = draftFolderFromFilePath(filePath);
  const parts = (folder ?? filePath).replace(/\\/g, "/").split("/").filter(Boolean);
  const name = folder ? parts[parts.length - 1] ?? "" : parts[parts.length - 2] ?? "";
  return titleFromTopicOrFolder("", name);
}

/** Keep the first H1 in sync with the manuscript title when saving. */
export function applyMarkdownTitle(content: string, title: string): string {
  const nextTitle = title.trim();
  if (!nextTitle) return content;
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const index = lines.findIndex((line) => /^#\s+/.test(line));
  if (index >= 0) {
    lines[index] = `# ${nextTitle}`;
    return lines.join("\n");
  }
  if (!content.trim()) return `# ${nextTitle}\n`;
  return `# ${nextTitle}\n\n${content.replace(/^\n+/, "")}`;
}

export function pickDefaultDraftOpenPath(drafts: UnpublishedDraft[]): string | undefined {
  const draft = drafts[0];
  return draft?.articlePath ?? draft?.topicPath;
}

/** Prefer article.md in the same folder; never stay on topic.md / draft.md / untitled. */
export function selectOpenArticle<T extends { id: string; filePath?: string }>(
  articles: T[],
  activeId: string,
): T | null {
  const manuscripts = articles.filter(
    (item) => item.filePath && /\/article\.md$/i.test(item.filePath.replace(/\\/g, "/")),
  );
  const current = manuscripts.find((item) => item.id === activeId)
    ?? manuscripts.find((item) => item.filePath === activeId);
  if (current) return current;
  const wanted = articles.find((item) => item.id === activeId)?.filePath ?? activeId;
  if (wanted && isOpenableDraftMarkdown(wanted)) {
    const articlePath = toDraftArticlePath(wanted);
    const mapped = manuscripts.find(
      (item) => item.filePath && toDraftArticlePath(item.filePath) === articlePath,
    );
    if (mapped) return mapped;
    // Do not fall back to another draft while this manuscript is still loading.
    if (isManuscriptArticlePath(wanted) || isManuscriptArticlePath(activeId)) return null;
  }
  return manuscripts[0] ?? null;
}

export function toUnpublishedDraft(input: {
  folder: string;
  dirPath: string;
  fileNames: string[];
  articlePath?: string;
  topicPath?: string;
  topicMarkdown?: string;
}): UnpublishedDraft | null {
  if (input.fileNames.some(isPublishedMarker)) return null;
  if (!input.articlePath && !input.topicPath) return null;
  return {
    folder: input.folder,
    title: titleFromTopicOrFolder(input.topicMarkdown, input.folder),
    dirPath: input.dirPath,
    articlePath: input.articlePath,
    topicPath: input.topicPath,
    hasReview: input.fileNames.some((name) => /^review\.md$/i.test(name)),
    hasImages: input.fileNames.some((name) => /^imgs$/i.test(name)),
  };
}

export function matchUnpublishedDrafts(query: string, drafts: UnpublishedDraft[]): UnpublishedDraft[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return drafts.filter((draft) => {
    const haystack = `${draft.folder} ${draft.title}`.toLowerCase();
    return needle.split(/\s+/).every((part) => haystack.includes(part));
  });
}

export type UnpublishedDraftsIntent = "create" | "continue";

/** @deprecated Use "create" | "continue". */
export type LegacyUnpublishedDraftsIntent = "new" | "resume";

export function normalizeUnpublishedDraftsIntent(
  intent: UnpublishedDraftsIntent | LegacyUnpublishedDraftsIntent,
): UnpublishedDraftsIntent {
  if (intent === "new") return "create";
  if (intent === "resume") return "continue";
  return intent;
}

export function formatUnpublishedDraftsContext(
  drafts: UnpublishedDraft[],
  query = "",
  intent: UnpublishedDraftsIntent | LegacyUnpublishedDraftsIntent = "continue",
): string {
  const mode = normalizeUnpublishedDraftsIntent(intent);
  const matched = matchUnpublishedDrafts(query, drafts);
  const continueMatch =
    mode === "continue" &&
    (matched.length === 1 || (!query.trim() && drafts.length === 1));
  const continueTarget = continueMatch ? (matched[0] ?? drafts[0]) : undefined;
  const lines = [
    "[未推送草稿]",
    `status: ${drafts.length > 0 ? "ok" : "empty"}`,
    `intent: ${mode}`,
    "",
    "规则：",
    mode === "create"
      ? "- 本次是 /article create 开新题。禁止续写下列旧稿，禁止 `open_article` 旧路径，禁止改旧 `article.md`。圆桌结束、用户确认后才 mkdir。"
      : "- 本次是 /article edit <target> 继续已定题稿。下列目录还没推送到公众号。直接共创，不要再 mkdir，不要再开会定同一篇。",
    mode === "continue"
      ? "- 继续时用 `open_article` 把该篇 `article.md` 定位为当前文稿（没有就定位 `topic.md`），不要替用户切换到编辑栏。用户自己点「编辑」就会看到这篇。然后点名写手 / 配图师 / 主编 / 发行。"
      : "- 用户要继续旧稿时请用 /article edit <关键词>，不要在 /article create 里续写。",
    "- 审稿只写该目录 `review.md`，不要创建 `.niuma-article/` 或另一篇 drafts。",
    mode === "create"
      ? "- 排版用 /format，推草稿箱用 /publish。仅切编辑栏用 /article edit（无 target）。"
      : "- 没有未推送草稿时，请用户改用 /article create。排版用 /format，推草稿箱用 /publish。",
    drafts.length === 0
      ? mode === "create"
        ? "- 当前没有未推送草稿，按新选题开会。"
        : "- 当前没有未推送草稿，不要 mkdir，请用户改用 /article create。"
      : "",
    mode === "continue" && continueTarget
      ? `- 本次请直接继续：《${continueTarget.title}》`
      : "",
    mode === "continue" && !query.trim() && drafts.length > 1
      ? "- 有多篇未推送草稿，请用户点名一篇，不要默认改最新一篇以外的文件。"
      : "",
    "",
    mode === "create" ? "## 对照（禁止续写）" : "## 可继续",
  ].filter(Boolean);

  if (drafts.length === 0) {
    lines.push("(无)");
    return lines.join("\n");
  }

  for (const draft of drafts) {
    const bits = [
      draft.articlePath ? "有稿" : "仅选题",
      draft.hasImages ? "有配图" : "",
      draft.hasReview ? "有审稿" : "",
    ].filter(Boolean);
    lines.push(`- ${draft.folder}：《${draft.title}》 ${bits.join(" · ")}`);
    const openPath = draft.articlePath ?? draft.topicPath;
    if (openPath) lines.push(`  ${openPath}`);
  }
  return lines.join("\n");
}

export async function loadUnpublishedDrafts(): Promise<UnpublishedDraft[]> {
  const { getArtifactDir } = await import("./path-adapter");
  const { listDirectory, readText } = await import("./fs");
  const root = await getArtifactDir();
  const entries = await listDirectory(root).catch(() => []);
  const drafts: UnpublishedDraft[] = [];

  for (const entry of entries.filter((item) => item.isDir && !item.name.startsWith("."))) {
    const children = await listDirectory(entry.path).catch(() => []);
    const topic = children.find((child) => !child.isDir && /^topic\.md$/i.test(child.name));
    const article = children.find((child) => !child.isDir && /^article\.md$/i.test(child.name));
    const topicMarkdown = topic ? await readText(topic.path).catch(() => "") : "";
    const draft = toUnpublishedDraft({
      folder: entry.name,
      dirPath: entry.path,
      fileNames: children.map((child) => child.name),
      articlePath: article?.path,
      topicPath: topic?.path,
      topicMarkdown,
    });
    if (draft) drafts.push(draft);
  }

  return drafts.sort((left, right) => right.folder.localeCompare(left.folder, "zh"));
}
