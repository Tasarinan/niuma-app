/**
 * Workspace WebView settings: `.niumaconfig/setting.json` ↔ localStorage.
 *
 * - First launch: write built-in defaults to `setting.json`, apply to localStorage.
 * - Later launches: load `setting.json` into localStorage (workspace is source of truth).
 * - On exit / page hide: persist tracked localStorage keys back to `setting.json`.
 */

import { invoke } from "@tauri-apps/api/core";
import i18n, {
  DEFAULT_APP_LOCALE,
  LOCALE_STORAGE_KEY,
  type AppLocale,
} from "@/i18n";
import { STORAGE_KEYS } from "@/config";
import { DEFAULT_STT_LANGUAGE } from "@/config/stt.constants";
import { DEFAULT_CUSTOMIZABLE_STATE } from "./customizable.storage";
import { DEFAULT_RESPONSE_SETTINGS } from "./response-settings.storage";
import { DEFAULT_MEETING_VAD_SETTINGS } from "./meeting-vad-settings.storage";
import { NIUMA_LOCAL_STORAGE_SET_EVENT, safeLocalStorage } from "./helper";

/** Keys that are no longer read by the app; removed on startup to reduce clutter. */
export const DEPRECATED_WEBVIEW_STORAGE_KEYS = [
  "selected_system_prompt_id",
  "agents",
  "agent_skills",
  "agent_mcp_servers",
  "selected_agent_id",
  "previous_stt_provider",
  "niuma.articles",
  "niuma.artifact.articles",
  "niuma.artifact.lastOpenPath",
  "niuma.content.pendingOutlineFolder",
  "chat_history",
  "auto-configs-enabled",
] as const;

/** Never synced from `setting.json` — manuscripts live under `.artifacts/drafts/`. */
export const ARTICLE_UI_STORAGE_KEYS = [
  "niuma.artifact.articles",
  "niuma.artifact.lastOpenPath",
  "niuma.content.pendingOutlineFolder",
] as const;

/** Keys persisted to `setting.json` on exit. */
export const ACTIVE_WEBVIEW_STORAGE_KEYS = [
  STORAGE_KEYS.THEME,
  STORAGE_KEYS.TRANSPARENCY,
  STORAGE_KEYS.SCREENSHOT_CONFIG,
  STORAGE_KEYS.CUSTOM_AI_PROVIDERS,
  STORAGE_KEYS.CUSTOM_SPEECH_PROVIDERS,
  STORAGE_KEYS.SELECTED_AI_PROVIDER,
  STORAGE_KEYS.SELECTED_STT_PROVIDER,
  STORAGE_KEYS.SYSTEM_AUDIO_CONTEXT,
  STORAGE_KEYS.SYSTEM_AUDIO_QUICK_ACTIONS,
  STORAGE_KEYS.CUSTOMIZABLE,
  STORAGE_KEYS.Niuma_API_ENABLED,
  STORAGE_KEYS.SHORTCUTS,
  STORAGE_KEYS.SELECTED_AUDIO_INPUT_DEVICE,
  STORAGE_KEYS.SELECTED_AUDIO_OUTPUT_DEVICE,
  STORAGE_KEYS.RESPONSE_SETTINGS,
  STORAGE_KEYS.COMPLETION_QUICK_ACTIONS,
  STORAGE_KEYS.COMPLETION_QUICK_ACTIONS_VISIBLE,
  STORAGE_KEYS.CONTEXT_MEMORY_ENABLED,
  STORAGE_KEYS.CONTEXT_MEMORY_MAX_TOKENS,
  STORAGE_KEYS.CONTEXT_MEMORY_DAYS,
  STORAGE_KEYS.MEETING_ASSIST_MODE_ENABLED,
  STORAGE_KEYS.STT_LANGUAGE,
  STORAGE_KEYS.STT_TRANSLATION_ENABLED,
  STORAGE_KEYS.STT_TRANSLATION_LANGUAGE,
  STORAGE_KEYS.SPEAKER_DIARIZATION_ENABLED,
  STORAGE_KEYS.MEETING_VAD_SETTINGS,
  STORAGE_KEYS.USER_IDENTITY,
  STORAGE_KEYS.IMA_CONFIG,
  STORAGE_KEYS.CHAT_COMPOSER_IMA,
  STORAGE_KEYS.CHAT_COMPOSER_WEB,
  "niuma_provider_configs_v1",
  "niuma_active_provider_v1",
  "niuma_active_api_provider_v1",
  "niuma_active_web_provider_v1",
  "niuma_proxy_url_v1",
  "niuma-hired-agents",
  "niuma-disabled-skills",
  "niuma:group-channels",
  "niuma.pomodoro.settings",
  "niuma.appMode",
  "niuma.sidebar.collapsed",
  "niuma.sidebar.width",
  "niuma.agent.debug",
  "niuma-zero-token-credentials",
  "niuma:ima:knowledge-base-id",
  LOCALE_STORAGE_KEY,
] as const;

export interface WorkspaceSettingsFile {
  version: number;
  localStorage: Record<string, string>;
}

export function purgeDeprecatedWebviewKeys(): void {
  for (const key of DEPRECATED_WEBVIEW_STORAGE_KEYS) {
    safeLocalStorage.removeItem(key);
  }
}

export function buildBuiltinWebviewDefaults(): Record<string, string> {
  return {
    [LOCALE_STORAGE_KEY]: DEFAULT_APP_LOCALE,
    [STORAGE_KEYS.STT_LANGUAGE]: DEFAULT_STT_LANGUAGE,
    [STORAGE_KEYS.STT_TRANSLATION_ENABLED]: "false",
    [STORAGE_KEYS.STT_TRANSLATION_LANGUAGE]: "fa",
    [STORAGE_KEYS.SELECTED_STT_PROVIDER]: JSON.stringify({
      provider: "elevenlabs-stt",
      variables: { model: "scribe_v1" },
    }),
    [STORAGE_KEYS.CUSTOMIZABLE]: JSON.stringify(DEFAULT_CUSTOMIZABLE_STATE),
    [STORAGE_KEYS.RESPONSE_SETTINGS]: JSON.stringify(DEFAULT_RESPONSE_SETTINGS),
    [STORAGE_KEYS.MEETING_VAD_SETTINGS]: JSON.stringify(
      DEFAULT_MEETING_VAD_SETTINGS,
    ),
    [STORAGE_KEYS.CHAT_COMPOSER_IMA]: "false",
    [STORAGE_KEYS.CHAT_COMPOSER_WEB]: "false",
    [STORAGE_KEYS.IMA_CONFIG]: JSON.stringify({
      kbId: "SkQ3gQvMnU-7gK8iEdsc2d5eMUK2ZgK2qpxpSM8XQ2U=",
      mifenFolderId: "folder_7494266356005993",
      feiniaoFolderId: "folder_7494267337452673",
    }),
    niuma_provider_configs_v1: "{}",
    [STORAGE_KEYS.SCREENSHOT_CONFIG]: JSON.stringify({
      mode: "manual",
      autoPrompt: "分析这张截图并给出要点与建议",
      enabled: true,
    }),
    "niuma.appMode": "assistant",
    [STORAGE_KEYS.THEME]: "system",
  };
}

export function buildDefaultSettingsFile(): WorkspaceSettingsFile {
  return {
    version: 1,
    localStorage: buildBuiltinWebviewDefaults(),
  };
}

export function applySettingsToLocalStorage(
  localStorageSettings: Record<string, string> | undefined,
): void {
  if (!localStorageSettings || typeof localStorageSettings !== "object") return;
  const skip = new Set<string>(ARTICLE_UI_STORAGE_KEYS);
  for (const [key, value] of Object.entries(localStorageSettings)) {
    if (skip.has(key)) continue;
    if (typeof value === "string") {
      safeLocalStorage.setItem(key, value);
    }
  }
}

/** @deprecated use applySettingsToLocalStorage */
export function applyWebviewDefaults(
  webview: Record<string, string> | undefined,
): number {
  if (!webview) return 0;
  let applied = 0;
  for (const [key, value] of Object.entries(webview)) {
    if (typeof value !== "string") continue;
    if (safeLocalStorage.getItem(key) != null) continue;
    safeLocalStorage.setItem(key, value);
    applied += 1;
  }
  return applied;
}

export function collectLocalStorageForSettings(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ACTIVE_WEBVIEW_STORAGE_KEYS) {
    const value = safeLocalStorage.getItem(key);
    if (value != null) out[key] = value;
  }
  return out;
}

export function serializeSettingsFile(file: WorkspaceSettingsFile): string {
  return JSON.stringify(file, null, 2);
}

function parseSettingsFile(raw: string): WorkspaceSettingsFile | null {
  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceSettingsFile> & {
      webview?: Record<string, string>;
    };
    const localStorageSettings =
      parsed.localStorage ??
      parsed.webview ??
      (typeof parsed === "object" ? {} : {});
    return {
      version: parsed.version ?? 1,
      localStorage: localStorageSettings as Record<string, string>,
    };
  } catch {
    return null;
  }
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function syncAppLocaleFromLocalStorage(): void {
  const raw = safeLocalStorage.getItem(LOCALE_STORAGE_KEY);
  const locale: AppLocale =
    raw?.startsWith("zh") ? "zh" : raw?.startsWith("en") ? "en" : DEFAULT_APP_LOCALE;
  if (i18n.language !== locale) {
    void i18n.changeLanguage(locale);
  }
}

let persistHooksRegistered = false;
let persistInFlight = false;
let persistDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const TRACKED_KEY_SET = new Set<string>(ACTIVE_WEBVIEW_STORAGE_KEYS);

export function scheduleWorkspaceSettingsPersist(): void {
  if (!isTauri()) return;
  if (persistDebounceTimer) clearTimeout(persistDebounceTimer);
  persistDebounceTimer = setTimeout(() => {
    persistDebounceTimer = null;
    void persistWorkspaceSettingsToFile();
  }, 600);
}

export async function persistWorkspaceSettingsToFile(): Promise<void> {
  if (!isTauri() || persistInFlight) return;
  persistInFlight = true;
  try {
    const payload: WorkspaceSettingsFile = {
      version: 1,
      localStorage: collectLocalStorageForSettings(),
    };
    await invoke("write_workspace_settings", {
      contents: serializeSettingsFile(payload),
    });
  } catch (error) {
    console.warn("[webview-config] persist setting.json failed:", error);
  } finally {
    persistInFlight = false;
  }
}

let localStoragePersistHooked = false;

function hookLocalStoragePersist(): void {
  if (localStoragePersistHooked) return;
  localStoragePersistHooked = true;
  const storage = window.localStorage;
  const nativeSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key: string, value: string) {
    nativeSet.call(this, key, value);
    if (this === storage && TRACKED_KEY_SET.has(key)) {
      scheduleWorkspaceSettingsPersist();
    }
  };
}

export function registerWorkspaceSettingsPersistence(): void {
  if (!isTauri() || persistHooksRegistered) return;
  persistHooksRegistered = true;
  hookLocalStoragePersist();
  const flush = () => {
    void persistWorkspaceSettingsToFile();
  };
  window.addEventListener("beforeunload", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener(NIUMA_LOCAL_STORAGE_SET_EVENT, (event) => {
    const key = (event as CustomEvent<{ key?: string }>).detail?.key;
    if (key && TRACKED_KEY_SET.has(key)) {
      scheduleWorkspaceSettingsPersist();
    }
  });
}

/**
 * Load or create `.niumaconfig/setting.json`, sync into localStorage.
 * Call once before any store reads localStorage on startup.
 */
export async function initializeWebviewStorageFromNiumaConfig(): Promise<void> {
  purgeDeprecatedWebviewKeys();

  if (!isTauri()) {
    applySettingsToLocalStorage(buildBuiltinWebviewDefaults());
    syncAppLocaleFromLocalStorage();
    return;
  }

  try {
    const raw = await invoke<string | null>("read_workspace_settings");
    if (raw == null) {
      const defaults = buildDefaultSettingsFile();
      await invoke("write_workspace_settings", {
        contents: serializeSettingsFile(defaults),
      });
      applySettingsToLocalStorage(defaults.localStorage);
    } else {
      const file = parseSettingsFile(raw);
      if (file) {
        applySettingsToLocalStorage(file.localStorage);
      } else {
        console.warn("[webview-config] invalid setting.json, recreating defaults");
        const defaults = buildDefaultSettingsFile();
        await invoke("write_workspace_settings", {
          contents: serializeSettingsFile(defaults),
        });
        applySettingsToLocalStorage(defaults.localStorage);
      }
    }
    registerWorkspaceSettingsPersistence();
    syncAppLocaleFromLocalStorage();
  } catch (error) {
    console.warn("[webview-config] workspace settings init failed:", error);
    applySettingsToLocalStorage(buildBuiltinWebviewDefaults());
    syncAppLocaleFromLocalStorage();
  }
}

/** Persist settings then exit (use instead of raw `exit_app` when possible). */
export async function exitAppWithSettingsSave(): Promise<void> {
  await persistWorkspaceSettingsToFile();
  await invoke("exit_app");
}
