/** Ask the existing full-screen editor to open a confirmed draft Markdown file. */

export const OPEN_WORKBENCH_ARTICLE_EVENT = "niuma:open-workbench-article";

export type WorkbenchArticleFocus = "editor" | "images" | "review";

export interface OpenWorkbenchArticleDetail {
  filePath: string;
  focus?: WorkbenchArticleFocus;
  /** Agents must leave this unset. Only a human click on 编辑 should switch the pane. */
  switchView?: boolean;
}

export function requestOpenWorkbenchArticle(detail: OpenWorkbenchArticleDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_WORKBENCH_ARTICLE_EVENT, { detail }));
}

export function subscribeOpenWorkbenchArticle(
  handler: (detail: OpenWorkbenchArticleDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<OpenWorkbenchArticleDetail>).detail;
    if (!detail?.filePath) return;
    handler(detail);
  };
  window.addEventListener(OPEN_WORKBENCH_ARTICLE_EVENT, listener);
  return () => window.removeEventListener(OPEN_WORKBENCH_ARTICLE_EVENT, listener);
}

/** Fired after an agent tool writes or edits a draft markdown file on disk. */
export const DRAFT_FILE_CHANGED_EVENT = "niuma:draft-file-changed";

export interface DraftFileChangedDetail {
  filePath: string;
}

export function notifyDraftFileChanged(filePath: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<DraftFileChangedDetail>(DRAFT_FILE_CHANGED_EVENT, {
      detail: { filePath },
    }),
  );
}

export function subscribeDraftFileChanged(
  handler: (detail: DraftFileChangedDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<DraftFileChangedDetail>).detail;
    if (!detail?.filePath) return;
    handler(detail);
  };
  window.addEventListener(DRAFT_FILE_CHANGED_EVENT, listener);
  return () => window.removeEventListener(DRAFT_FILE_CHANGED_EVENT, listener);
}
