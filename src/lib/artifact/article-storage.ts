import { isOpenableDraftMarkdown, LAST_OPEN_DRAFT_KEY, toDraftArticlePath } from "./drafts";

export const ARTICLES_STORAGE_KEY = "niuma.artifact.articles";
export const LEGACY_ARTICLES_STORAGE_KEY = "niuma.articles";

function isDraftRecord(item: unknown): item is { filePath: string } {
  if (!item || typeof item !== "object") return false;
  const path = (item as { filePath?: unknown }).filePath;
  return typeof path === "string" && isOpenableDraftMarkdown(path) && /\/article\.md$/i.test(path.replace(/\\/g, "/"));
}

/** Drop leftover untitled-article.md (and any non-draft) from catalog + last-open. */
export function migrateArticleLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const last = window.localStorage.getItem(LAST_OPEN_DRAFT_KEY);
    if (last && !isOpenableDraftMarkdown(last)) {
      window.localStorage.removeItem(LAST_OPEN_DRAFT_KEY);
    } else if (last) {
      const articlePath = toDraftArticlePath(last);
      if (articlePath !== last) window.localStorage.setItem(LAST_OPEN_DRAFT_KEY, articlePath);
    }
    for (const key of [ARTICLES_STORAGE_KEY, LEGACY_ARTICLES_STORAGE_KEY]) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        window.localStorage.removeItem(key);
        continue;
      }
      if (!Array.isArray(parsed)) {
        window.localStorage.removeItem(key);
        continue;
      }
      const kept = parsed.filter(isDraftRecord);
      if (kept.length === 0) window.localStorage.removeItem(key);
      else if (kept.length !== parsed.length) {
        window.localStorage.setItem(key, JSON.stringify(kept));
      }
    }
  } catch {
    // ignore quota / private-mode failures
  }
}

export function readStoredArticles<T>(): T[] {
  migrateArticleLocalStorage();
  if (typeof window === "undefined") return [];
  try {
    const raw =
      window.localStorage.getItem(ARTICLES_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_ARTICLES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed.filter(isDraftRecord) as T[] : [];
  } catch {
    return [];
  }
}

export function persistStoredArticles(articles: Array<{ filePath?: string }>): void {
  if (typeof window === "undefined") return;
  migrateArticleLocalStorage();
  const drafts = articles.filter((item) => item.filePath && /\/article\.md$/i.test(item.filePath.replace(/\\/g, "/")));
  try {
    window.localStorage.setItem(ARTICLES_STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // ignore
  }
}

export function readLastOpenDraftPath(): string | undefined {
  migrateArticleLocalStorage();
  if (typeof window === "undefined") return undefined;
  try {
    const last = window.localStorage.getItem(LAST_OPEN_DRAFT_KEY) || undefined;
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
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_OUTLINE_FOLDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOutlineFolder;
    if (typeof parsed?.theme === "string" && typeof parsed?.folder === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

export function writePendingOutlineFolder(pending: PendingOutlineFolder): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PENDING_OUTLINE_FOLDER_KEY, JSON.stringify(pending));
  } catch {
    // ignore quota / private-mode failures
  }
}

export function clearPendingOutlineFolder(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_OUTLINE_FOLDER_KEY);
  } catch {
    // ignore
  }
}

export function writeLastOpenDraftPath(path: string): void {
  if (typeof window === "undefined") return;
  try {
    if (!isOpenableDraftMarkdown(path)) return;
    window.localStorage.setItem(LAST_OPEN_DRAFT_KEY, toDraftArticlePath(path));
  } catch {
    // ignore quota / private-mode failures
  }
}
