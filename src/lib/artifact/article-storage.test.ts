import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isOpenableDraftMarkdown, LAST_OPEN_DRAFT_KEY } from "./drafts";
import {
  ARTICLES_STORAGE_KEY,
  LEGACY_ARTICLES_STORAGE_KEY,
  migrateArticleLocalStorage,
  persistStoredArticles,
  readLastOpenDraftPath,
  readStoredArticles,
} from "./article-storage";

const leftover = String.raw`C:\N-5CG2150YY9-Data\dvkx47\Documents\niuma\artifact\untitled-article.md`;
const draft = "C:/niuma/.artifacts/drafts/20260903-ai-builder/article.md";

function installMemoryStorage() {
  const store = new Map<string, string>();
  const mem: Storage = {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: (key) => {
      store.delete(String(key));
    },
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
  vi.stubGlobal("localStorage", mem);
  Object.defineProperty(window, "localStorage", { configurable: true, value: mem });
}

beforeEach(() => {
  installMemoryStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("article localStorage migration", () => {
  it("purges untitled last-open and catalog leftovers", () => {
    localStorage.setItem(LAST_OPEN_DRAFT_KEY, leftover);
    localStorage.setItem(
      ARTICLES_STORAGE_KEY,
      JSON.stringify([
        { id: "old", filePath: leftover, title: "Untitled Article", content: "stale" },
        { id: draft, filePath: draft, title: "wealth", content: "# hi" },
      ]),
    );

    migrateArticleLocalStorage();

    expect(localStorage.getItem(LAST_OPEN_DRAFT_KEY)).toBeFalsy();
    expect(JSON.parse(localStorage.getItem(ARTICLES_STORAGE_KEY) || "[]")).toEqual([
      { id: draft, filePath: draft, title: "wealth", content: "# hi" },
    ]);
    expect(readLastOpenDraftPath()).toBeUndefined();
  });

  it("does not persist untitled-article.md back into localStorage", () => {
    expect(isOpenableDraftMarkdown(draft)).toBe(true);
    persistStoredArticles([
      { filePath: leftover },
      { filePath: draft },
    ]);
    expect(JSON.parse(localStorage.getItem(ARTICLES_STORAGE_KEY) || "[]")).toEqual([
      { filePath: draft },
    ]);
  });

  it("readStoredArticles ignores leftover untitled after a dirty catalog", () => {
    localStorage.setItem(
      LEGACY_ARTICLES_STORAGE_KEY,
      JSON.stringify([{ filePath: leftover, title: "Untitled Article" }]),
    );
    expect(readStoredArticles()).toEqual([]);
    expect(localStorage.getItem(LEGACY_ARTICLES_STORAGE_KEY)).toBeFalsy();
  });

  it("rewrites last-open draft.md to article.md in the same folder", () => {
    localStorage.setItem(
      LAST_OPEN_DRAFT_KEY,
      "C:/niuma/.artifacts/drafts/20260902-claude-51-de-ai-wei/draft.md",
    );
    expect(readLastOpenDraftPath()).toBe(
      "C:/niuma/.artifacts/drafts/20260902-claude-51-de-ai-wei/article.md",
    );
  });
});
