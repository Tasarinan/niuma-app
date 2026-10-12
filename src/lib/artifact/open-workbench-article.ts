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

/** Ask the open editor to write unsaved manuscript text before an agent turn. */
export const FLUSH_OPEN_MANUSCRIPT_EVENT = "niuma:flush-open-manuscript";

export type FlushOpenManuscriptResult = "ok" | "conflict" | "absent";

interface FlushOpenManuscriptDetail {
  respond: (result: Promise<FlushOpenManuscriptResult> | FlushOpenManuscriptResult) => void;
}

export function requestFlushOpenManuscript(): Promise<FlushOpenManuscriptResult> {
  if (typeof window === "undefined") return Promise.resolve("absent");
  let pending: Promise<FlushOpenManuscriptResult> | null = null;
  window.dispatchEvent(
    new CustomEvent<FlushOpenManuscriptDetail>(FLUSH_OPEN_MANUSCRIPT_EVENT, {
      detail: {
        respond: (result) => {
          pending = Promise.resolve(result);
        },
      },
    }),
  );
  return pending ?? Promise.resolve("absent");
}

export function subscribeFlushOpenManuscript(
  handler: () => Promise<FlushOpenManuscriptResult> | FlushOpenManuscriptResult,
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<FlushOpenManuscriptDetail>).detail;
    if (!detail?.respond) return;
    detail.respond(handler());
  };
  window.addEventListener(FLUSH_OPEN_MANUSCRIPT_EVENT, listener);
  return () => window.removeEventListener(FLUSH_OPEN_MANUSCRIPT_EVENT, listener);
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
