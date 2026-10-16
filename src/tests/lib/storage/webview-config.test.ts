import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  applySettingsToLocalStorage,
  purgeDeprecatedWebviewKeys,
  collectLocalStorageForSettings,
  DEPRECATED_WEBVIEW_STORAGE_KEYS,
  buildDefaultSettingsFile,
} from "@/lib/storage/webview-config";
import { STORAGE_KEYS } from "@/config";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  });
}

describe("webview-config", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it("applies settings file into localStorage", () => {
    applySettingsToLocalStorage({
      theme: "dark",
      stt_language: "zh",
    });
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(localStorage.getItem("stt_language")).toBe("zh");
  });

  it("purges deprecated keys", () => {
    for (const key of DEPRECATED_WEBVIEW_STORAGE_KEYS) {
      localStorage.setItem(key, "x");
    }
    purgeDeprecatedWebviewKeys();
    for (const key of DEPRECATED_WEBVIEW_STORAGE_KEYS) {
      expect(localStorage.getItem(key)).toBeFalsy();
    }
  });

  it("collects only tracked keys", () => {
    localStorage.setItem(STORAGE_KEYS.THEME, "light");
    localStorage.setItem("random-key", "ignore");
    const collected = collectLocalStorageForSettings();
    expect(collected[STORAGE_KEYS.THEME]).toBe("light");
    expect(collected["random-key"]).toBeUndefined();
  });

  it("default settings file has version and localStorage", () => {
    const file = buildDefaultSettingsFile();
    expect(file.version).toBe(1);
    expect(file.localStorage[STORAGE_KEYS.THEME]).toBe("system");
  });
});
