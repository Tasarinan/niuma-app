import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isOpenableDraftMarkdown, LAST_OPEN_DRAFT_KEY } from "@/lib/artifact/drafts";
import {
  ARTICLES_STORAGE_KEY,
  LEGACY_ARTICLES_STORAGE_KEY,
  migrateArticleLocalStorage,
  persistStoredArticles,
  readLastOpenDraftPath,
  readStoredArticles,
  writeLastOpenDraftPath,
} from "@/lib/artifact/article-storage";

const leftover = String.raw`C:\N-5CG2150YY9-Data\dvkx47\Documents\niuma\artifact\untitled-article.md`;
const draft = "C:/niuma/.artifacts/drafts/20260903-ai-builder/article.md";

function installMemoryStorage() {
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  const make = (store: Map<string, string>): Storage => ({
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
  });
  const localMem = make(local);
  const sessionMem = make(session);
  vi.stubGlobal("localStorage", localMem);
  vi.stubGlobal("sessionStorage", sessionMem);
  Object.defineProperty(window, "localStorage", { configurable: true, value: localMem });
  Object.defineProperty(window, "sessionStorage", { configurable: true, value: sessionMem });
}

beforeEach(() => {
  installMemoryStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("article storage", () => {
  it("purges legacy catalog from localStorage and does not keep last-open there", () => {
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
    expect(localStorage.getItem(ARTICLES_STORAGE_KEY)).toBeFalsy();
    expect(readStoredArticles()).toEqual([]);
    expect(readLastOpenDraftPath()).toBeUndefined();
  });

  it("does not persist catalog to localStorage", () => {
    expect(isOpenableDraftMarkdown(draft)).toBe(true);
    persistStoredArticles([{ filePath: leftover }, { filePath: draft }]);
    expect(localStorage.getItem(ARTICLES_STORAGE_KEY)).toBeFalsy();
    expect(sessionStorage.getItem(ARTICLES_STORAGE_KEY)).toBeFalsy();
  });

  it("migrates legacy catalog key away", () => {
    localStorage.setItem(
      LEGACY_ARTICLES_STORAGE_KEY,
      JSON.stringify([{ filePath: leftover, title: "Untitled Article" }]),
    );
    expect(readStoredArticles()).toEqual([]);
    expect(localStorage.getItem(LEGACY_ARTICLES_STORAGE_KEY)).toBeFalsy();
  });

  it("rewrites last-open draft.md to article.md in session", () => {
    sessionStorage.setItem(
      LAST_OPEN_DRAFT_KEY,
      "C:/niuma/.artifacts/drafts/20260902-claude-51-de-ai-wei/draft.md",
    );
    expect(readLastOpenDraftPath()).toBe(
      "C:/niuma/.artifacts/drafts/20260902-claude-51-de-ai-wei/article.md",
    );
  });

  it("persists the bound co-creation article.md path in session", () => {
    writeLastOpenDraftPath("C:/niuma/.artifacts/drafts/20260917-workbuddy-本地配置/topic.md");
    expect(readLastOpenDraftPath()).toBe(
      "C:/niuma/.artifacts/drafts/20260917-workbuddy-本地配置/article.md",
    );
  });
});
