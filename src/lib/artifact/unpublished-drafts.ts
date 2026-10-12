/** In-progress WeChat drafts that were confirmed but not published yet. */

import type { ContentRosterCopy } from "@/lib/content/roster-workflow";
import { readLastOpenDraftPath } from "./article-storage";
import {
  CONTENT_DRAFTS_DIR,
  DRAFT_ARTICLE_FILENAME,
  extractDraftFolderName,
  findReusableDraftSlug,
  isManuscriptArticlePath,
  isOpenableDraftMarkdown,
  isSameDraftTheme,
  redirectDraftWritePath,
  resolveLockedDraftFolder,
  rewriteDraftFoldersInCommand,
  toDraftArticlePath,
  toDraftDatePrefix,
} from "./drafts";
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

export function pickReusableDraft(
  drafts: UnpublishedDraft[],
  theme: string,
  date: Date = new Date(),
): UnpublishedDraft | undefined {
  const today = drafts.filter((draft) => draft.folder.startsWith(`${toDraftDatePrefix(date)}-`));
  const similar = today.filter(
    (draft) => isSameDraftTheme(draft.folder, theme) || isSameDraftTheme(draft.title, theme),
  );
  if (similar.length === 0) {
    const slug = findReusableDraftSlug(today.map((draft) => draft.folder), theme, date);
    return today.find((draft) => draft.folder === slug);
  }
  return similar.find((draft) => draft.articlePath) ?? similar[0];
}

export function formatOutlineFolderAskContext(input: { folder: string; theme: string }): string {
  return [
    "[等待确认]",
    `拟创建：${CONTENT_DRAFTS_DIR}/${input.folder}/`,
    `主题：${input.theme}`,
    "本回合只问用户要不要新建这个目录。禁止调研、禁止 write、禁止 mkdir、禁止写 article.md。",
    "请用户回复「确认」或「取消」。确认前目录不存在。",
  ].join("\n");
}

export function formatLockedOutlineFolderContext(input: {
  folder: string;
  reused: boolean;
}): string {
  return [
    "[本次草稿目录已锁定]",
    `folder: ${input.folder}`,
    `path: ${CONTENT_DRAFTS_DIR}/${input.folder}/`,
    input.reused
      ? "沿用已有目录。禁止 mkdir，禁止再写其它 YYYYMMDD-相近主题 目录。"
      : "系统已指定这一目录。禁止 mkdir 第二个，禁止把很难/难写成两个文件夹。",
    `只准 write ${CONTENT_DRAFTS_DIR}/${input.folder}/ 下的 topic.md、research.md、article.md。`,
  ].join("\n");
}

export function formatOutlineFolderReuseContext(
  drafts: UnpublishedDraft[],
  theme: string,
  date: Date = new Date(),
  lockedFolder?: string,
): string {
  const prefix = toDraftDatePrefix(date);
  const today = drafts.filter((draft) => draft.folder.startsWith(`${prefix}-`));
  const reuse = pickReusableDraft(drafts, theme, date);
  const locked = lockedFolder ?? reuse?.folder ?? resolveLockedDraftFolder(theme, today.map((draft) => draft.folder), date).folder;
  const lines = [
    "[草稿目录]",
    `今天 ${prefix} 已有 ${today.length} 个目录。同一主题只准沿用「${locked}」。`,
  ];
  for (const draft of today) {
    const files = [draft.articlePath ? "article.md" : "", draft.topicPath ? "topic.md" : ""]
      .filter(Boolean)
      .join("、");
    lines.push(`- ${draft.folder}${files ? `（${files}）` : ""}`);
  }
  lines.push(`本次必须使用：${CONTENT_DRAFTS_DIR}/${locked}/。不要 mkdir 其它目录。`);
  return lines.join("\n");
}

export async function listDraftFolderNames(): Promise<string[]> {
  const { getArtifactDir } = await import("./path-adapter");
  const { listDirectory } = await import("./fs");
  const root = await getArtifactDir();
  const entries = await listDirectory(root).catch(() => []);
  return entries.filter((entry) => entry.isDir && /^\d{8}-/.test(entry.name)).map((entry) => entry.name);
}

function preferredLockedFolder(date: Date = new Date()): string | undefined {
  const last = readLastOpenDraftPath();
  const folder = last ? extractDraftFolderName(last) : undefined;
  const prefix = `${toDraftDatePrefix(date)}-`;
  return folder?.startsWith(prefix) ? folder : undefined;
}

export async function redirectSameThemeDraftPath(requestedPath: string, date: Date = new Date()): Promise<string> {
  const folders = await listDraftFolderNames();
  return redirectDraftWritePath(requestedPath, folders, date, preferredLockedFolder(date)).path;
}

export async function rewriteSameThemeDraftCommand(command: string, date: Date = new Date()): Promise<string> {
  const folders = await listDraftFolderNames();
  return rewriteDraftFoldersInCommand(command, folders, date, preferredLockedFolder(date));
}

export async function planOutlineDraftFolder(
  theme: string,
  date: Date = new Date(),
): Promise<{ folder: string; reused: boolean; theme: string }> {
  const drafts = await loadUnpublishedDrafts();
  const picked = pickReusableDraft(drafts, theme, date);
  const folders = await listDraftFolderNames();
  const resolved = picked
    ? { folder: picked.folder, reused: true }
    : resolveLockedDraftFolder(theme, folders, date);
  return { ...resolved, theme: theme.trim() };
}

export async function assertDraftFolderWritable(path: string): Promise<void> {
  const folder = extractDraftFolderName(path);
  if (!folder) return;
  const folders = await listDraftFolderNames();
  if (folders.includes(folder)) return;
  throw new Error(`草稿目录 ${folder} 还不存在。请先问用户确认后再创建，不要自己 mkdir。`);
}

export async function lockOutlineDraftFolder(
  theme: string,
  date: Date = new Date(),
): Promise<{ folder: string; dirPath: string; articlePath: string; reused: boolean }> {
  const { getArtifactDir } = await import("./path-adapter");
  const { join } = await import("@tauri-apps/api/path");
  const { writeText } = await import("./fs");
  const resolved = await planOutlineDraftFolder(theme, date);
  const dirPath = await join(await getArtifactDir(), resolved.folder);
  if (!resolved.reused) {
    const topicPath = await join(dirPath, "topic.md");
    await writeText(topicPath, `# ${theme.trim()}\n\n主题已锁定。标题后定。\n`);
  }
  const articlePath = await join(dirPath, DRAFT_ARTICLE_FILENAME);
  return { ...resolved, dirPath, articlePath };
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
  copy?: Partial<ContentRosterCopy>,
): string {
  const mode = normalizeUnpublishedDraftsIntent(intent);
  const matched = matchUnpublishedDrafts(query, drafts);
  const continueMatch =
    mode === "continue" &&
    (matched.length === 1 || (!query.trim() && drafts.length === 1));
  const continueTarget = continueMatch ? (matched[0] ?? drafts[0]) : undefined;
  const draft = (copy?.draftCommand ?? "outline").replace(/^\//, "");
  const publish = (copy?.publishCommand ?? "publish").replace(/^\//, "");
  const specialists = (copy?.specialistNames ?? []).filter(Boolean);
  const ping = specialists.length ? `然后点名${specialists.join(" / ")}。` : "然后点名职责表里的其他角色。";
  const lines = [
    "[未推送草稿]",
    `status: ${drafts.length > 0 ? "ok" : "empty"}`,
    `intent: ${mode}`,
    "",
    "规则：",
    mode === "create"
      ? `- 本次是 /${draft} <主题> 写框架。禁止把全文一次写完，禁止编造亲身经历，禁止续写下列旧稿。用户还没选定主题时不要 mkdir。`
      : `- 下列目录还没推送到公众号。直接打开已有稿，不要再 mkdir，不要再开会定同一篇。`,
    mode === "continue"
      ? `- 继续时用 \`open_article\` 把该篇 \`article.md\` 定位为当前文稿（没有就定位 \`topic.md\`），不要替用户切换到编辑栏。用户自己点「编辑」，选中文字后用选区旁的图标气泡续写或修改。${ping}`
      : `- 用户要继续旧稿时请打开编辑栏，不要在 /${draft} 里把旧稿写成新全文。`,
    "- 审稿在选区旁图标气泡的审核，不要创建 `.niuma-article/` 或另一篇 drafts。",
    mode === "create"
      ? `- 排版用编辑栏「排全文」。推草稿箱用稿件信息里的发布（/${publish} 仅后备）。群发只在公众号后台。`
      : `- 没有未推送草稿时，请用户改用 /propose 选题，再 /${draft} <主题>。排版用编辑栏「排全文」，推草稿箱用稿件信息里的发布。`,
    drafts.length === 0
      ? mode === "create"
        ? "- 当前没有未推送草稿，按用户选定的新主题写框架。"
        : `- 当前没有未推送草稿，不要 mkdir，请用户改用 /propose 再 /${draft} <主题>。`
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
