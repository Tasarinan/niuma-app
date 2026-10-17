import { isOpenableDraftMarkdown, LAST_OPEN_DRAFT_KEY, toDraftArticlePath } from "./drafts";

export const ARTICLES_STORAGE_KEY = "niuma.artifact.articles";
export const LEGACY_ARTICLES_STORAGE_KEY = "niuma.articles";

function sessionStore(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Drop legacy article catalog + last-open from localStorage; last-open uses session only. */
export function migrateArticleLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of [ARTICLES_STORAGE_KEY, LEGACY_ARTICLES_STORAGE_KEY]) {
      window.localStorage.removeItem(key);
    }
    const legacyLast = window.localStorage.getItem(LAST_OPEN_DRAFT_KEY);
    if (legacyLast) {
      window.localStorage.removeItem(LAST_OPEN_DRAFT_KEY);
      if (isOpenableDraftMarkdown(legacyLast)) {
        writeLastOpenDraftPath(legacyLast);
      }
    }
    const session = sessionStore();
    const last = session?.getItem(LAST_OPEN_DRAFT_KEY);
    if (last && !isOpenableDraftMarkdown(last)) {
      session?.removeItem(LAST_OPEN_DRAFT_KEY);
    } else if (last) {
      const articlePath = toDraftArticlePath(last);
      if (articlePath !== last) session?.setItem(LAST_OPEN_DRAFT_KEY, articlePath);
    }
  } catch {
    // ignore quota / private-mode failures
  }
}

/** Catalog is scanned from `.artifacts/drafts/` — not stored in localStorage/setting.json. */
export function readStoredArticles<T>(): T[] {
  migrateArticleLocalStorage();
  return [];
}

export function persistStoredArticles(_articles: Array<{ filePath?: string }>): void {
  migrateArticleLocalStorage();
}

export function readLastOpenDraftPath(): string | undefined {
  migrateArticleLocalStorage();
  const session = sessionStore();
  if (!session) return undefined;
  try {
    const last = session.getItem(LAST_OPEN_DRAFT_KEY) || undefined;
    return last && isOpenableDraftMarkdown(last) ? toDraftArticlePath(last) : undefined;
  } catch {
    return undefined;
  }
}

export const PENDING_OUTLINE_FOLDER_KEY = "niuma.content.pendingOutlineFolder";

export interface PendingOutlineFolder {
  theme: string;
  folder: string;
}

export function readPendingOutlineFolder(): PendingOutlineFolder | null {
  const session = sessionStore();
  if (!session) return null;
  try {
    const raw = session.getItem(PENDING_OUTLINE_FOLDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOutlineFolder;
    if (typeof parsed?.theme === "string" && typeof parsed?.folder === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

export function writePendingOutlineFolder(pending: PendingOutlineFolder): void {
  const session = sessionStore();
  if (!session) return;
  try {
    session.setItem(PENDING_OUTLINE_FOLDER_KEY, JSON.stringify(pending));
  } catch {
    // ignore quota / private-mode failures
  }
}

export function clearPendingOutlineFolder(): void {
  const session = sessionStore();
  if (!session) return;
  try {
    session.removeItem(PENDING_OUTLINE_FOLDER_KEY);
  } catch {
    // ignore
  }
}

export function writeLastOpenDraftPath(path: string): void {
  const session = sessionStore();
  if (!session) return;
  try {
    if (!isOpenableDraftMarkdown(path)) return;
    session.setItem(LAST_OPEN_DRAFT_KEY, toDraftArticlePath(path));
  } catch {
    // ignore quota / private-mode failures
  }
}
