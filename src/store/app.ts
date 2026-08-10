import { create } from "zustand";
import {
  AI_PROVIDERS,
  DEFAULT_SYSTEM_PROMPT,
  SPEECH_TO_TEXT_PROVIDERS,
  STORAGE_KEYS,
  DEFAULT_STT_LANGUAGE,
  DEFAULT_TRANSLATION_ENABLED,
  DEFAULT_TRANSLATION_LANGUAGE,
} from "@/config";
import { getPlatform, safeLocalStorage, trackAppStart } from "@/lib";
import { getShortcutsConfig } from "@/lib/storage";
import {
  getCustomizableState,
  setCustomizableState,
  updateAppIconVisibility,
  updateAlwaysOnTop,
  updateAutostart,
  updateContentProtected,
  DEFAULT_CUSTOMIZABLE_STATE,
  CursorType,
  updateCursorType,
  getUserIdentity,
  setUserIdentity as saveUserIdentity,
} from "@/lib/storage";
import { IContextType, ScreenshotConfig, TYPE_PROVIDER } from "@/types";
import curl2Json from "@bany/curl-to-json";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { enable, disable } from "@tauri-apps/plugin-autostart";

/** Resolve a Dispatch<SetStateAction<T>> style update against the current value. */
const resolveUpdate = <T>(update: T | ((prev: T) => T), prev: T): T =>
  typeof update === "function" ? (update as (prev: T) => T)(prev) : update;

const validateAndProcessCurlProviders = (
  providersJson: string,
  providerType: "AI" | "STT"
): TYPE_PROVIDER[] => {
  try {
    const parsed = JSON.parse(providersJson);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((p) => {
        try {
          curl2Json(p.curl);
          return true;
        } catch {
          return false;
        }
      })
      .map((p) => {
        const provider = { ...p, isCustom: true };
        if (providerType === "STT" && provider.curl) {
          provider.curl = provider.curl.replace(/AUDIO_BASE64/g, "AUDIO");
        }
        return provider;
      });
  } catch (e) {
    console.warn(`Failed to parse custom ${providerType} providers`, e);
    return [];
  }
};

const updateCursor = (type: CursorType | undefined) => {
  try {
    const currentWindow = getCurrentWindow();
    const platform = getPlatform();
    // For Linux, always use default cursor
    if (platform === "linux") {
      document.documentElement.style.setProperty("--cursor-type", "default");
      return;
    }
    const windowLabel = currentWindow.label;

    if (windowLabel === "dashboard" || windowLabel === "agent-chat") {
      // For dashboard and agent-chat, always use default cursor
      document.documentElement.style.setProperty("--cursor-type", "default");
      return;
    }

    // For overlay windows (main, capture-overlay-*)
    const safeType = type || "invisible";
    const cursorValue = type === "invisible" ? "none" : safeType;
    document.documentElement.style.setProperty("--cursor-type", cursorValue);
  } catch {
    document.documentElement.style.setProperty("--cursor-type", "default");
  }
};

const computeAllAi = (custom: TYPE_PROVIDER[]): TYPE_PROVIDER[] => [
  ...AI_PROVIDERS,
  ...custom,
];
const computeAllStt = (custom: TYPE_PROVIDER[]): TYPE_PROVIDER[] => [
  ...SPEECH_TO_TEXT_PROVIDERS,
  ...custom,
];

/**
 * Global app store (formerly AppContext). Session state now lives here in
 * zustand instead of React context — `useApp()` is a backwards-compatible hook
 * and `initAppStore()` bootstraps the one-time side-effects.
 */
export const useAppStore = create<IContextType>((set, get) => ({
  // ----- state -----
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  selectedAudioDevices: {
    input: safeLocalStorage.getItem(STORAGE_KEYS.SELECTED_AUDIO_INPUT_DEVICE) || "",
    output: safeLocalStorage.getItem(STORAGE_KEYS.SELECTED_AUDIO_OUTPUT_DEVICE) || "",
  },
  customAiProviders: [],
  selectedAIProvider: { provider: "", variables: {} },
  customSttProviders: [],
  // Default STT provider: ElevenLabs Scribe V1 (mirrors niuma (Vue)'s
  // defaultSettings.sttApi default). Only applies to fresh installs - users
  // who already saved a selection load it from localStorage below and this
  // initial value is never used. The API key is intentionally left blank
  // for the user to fill in.
  selectedSttProvider: { provider: "elevenlabs-stt", variables: { model: "scribe_v1" } },
  screenshotConfiguration: {
    mode: "manual",
    autoPrompt: "Analyze this screenshot and provide insights",
    enabled: true,
  },
  customizable: DEFAULT_CUSTOMIZABLE_STATE,
  hasActiveLicense: true,
  NiumaApiEnabled:
    safeLocalStorage.getItem(STORAGE_KEYS.Niuma_API_ENABLED) === "true",
  sttLanguage:
    safeLocalStorage.getItem(STORAGE_KEYS.STT_LANGUAGE) || DEFAULT_STT_LANGUAGE,
  sttTranslationEnabled:
    safeLocalStorage.getItem(STORAGE_KEYS.STT_TRANSLATION_ENABLED) === "true" ||
    DEFAULT_TRANSLATION_ENABLED,
  sttTranslationLanguage:
    safeLocalStorage.getItem(STORAGE_KEYS.STT_TRANSLATION_LANGUAGE) ||
    DEFAULT_TRANSLATION_LANGUAGE,
  userIdentity: getUserIdentity(),
  allAiProviders: computeAllAi([]),
  allSttProviders: computeAllStt([]),

  // ----- actions -----
  setSelectedAudioDevices: (update) =>
    set((s) => ({
      selectedAudioDevices: resolveUpdate(update, s.selectedAudioDevices),
    })),

  onSetSelectedAIProvider: ({ provider, variables }) => {
    if (provider && !get().allAiProviders.some((p) => p.id === provider)) {
      console.warn(`Invalid AI provider ID: ${provider}`);
      return;
    }
    set((s) => ({ selectedAIProvider: { ...s.selectedAIProvider, provider, variables } }));
    const next = get().selectedAIProvider;
    if (next.provider) {
      safeLocalStorage.setItem(STORAGE_KEYS.SELECTED_AI_PROVIDER, JSON.stringify(next));
    }
  },

  onSetSelectedSttProvider: ({ provider, variables }) => {
    if (provider && !get().allSttProviders.some((p) => p.id === provider)) {
      console.warn(`Invalid STT provider ID: ${provider}`);
      return;
    }
    set((s) => ({ selectedSttProvider: { ...s.selectedSttProvider, provider, variables } }));
    const next = get().selectedSttProvider;
    if (next.provider) {
      safeLocalStorage.setItem(STORAGE_KEYS.SELECTED_STT_PROVIDER, JSON.stringify(next));
    }
  },

  setScreenshotConfiguration: (update) =>
    set((s) => ({
      screenshotConfiguration: resolveUpdate(update, s.screenshotConfiguration),
    })),

  toggleAppIconVisibility: async (isVisible) => {
    const newState = updateAppIconVisibility(isVisible);
    set({ customizable: newState });
    try {
      await invoke("set_app_icon_visibility", { visible: isVisible });
      get().loadData();
    } catch (error) {
      console.error("Failed to toggle app icon visibility:", error);
    }
  },

  toggleAlwaysOnTop: async (isEnabled) => {
    const newState = updateAlwaysOnTop(isEnabled);
    set({ customizable: newState });
    try {
      await invoke("set_always_on_top", { enabled: isEnabled });
      get().loadData();
    } catch (error) {
      console.error("Failed to toggle always on top:", error);
    }
  },

  toggleAutostart: async (isEnabled) => {
    const newState = updateAutostart(isEnabled);
    set({ customizable: newState });
    try {
      if (isEnabled) {
        await enable();
      } else {
        await disable();
      }
      get().loadData();
    } catch (error) {
      console.error("Failed to toggle autostart:", error);
      set({ customizable: updateAutostart(!isEnabled) });
    }
  },

  toggleContentProtected: async (isEnabled) => {
    const newState = updateContentProtected(isEnabled);
    set({ customizable: newState });
    try {
      await invoke("set_content_protected", { protected: isEnabled });
    } catch (error) {
      console.error("Failed to toggle content protection:", error);
    }
  },

  loadData: () => {
    // Screenshot configuration
    const savedScreenshotConfig = safeLocalStorage.getItem(STORAGE_KEYS.SCREENSHOT_CONFIG);
    if (savedScreenshotConfig) {
      try {
        const parsed = JSON.parse(savedScreenshotConfig);
        if (typeof parsed === "object" && parsed !== null) {
          set({
            screenshotConfiguration: {
              mode: parsed.mode || "manual",
              autoPrompt: parsed.autoPrompt || "Analyze this screenshot and provide insights",
              enabled: parsed.enabled !== undefined ? parsed.enabled : false,
            } as ScreenshotConfig,
          });
        }
      } catch {
        console.warn("Failed to parse screenshot configuration");
      }
    }

    // Custom AI providers
    const savedAi = safeLocalStorage.getItem(STORAGE_KEYS.CUSTOM_AI_PROVIDERS);
    const aiList = savedAi ? validateAndProcessCurlProviders(savedAi, "AI") : [];
    set({ customAiProviders: aiList, allAiProviders: computeAllAi(aiList) });

    // Custom STT providers
    const savedStt = safeLocalStorage.getItem(STORAGE_KEYS.CUSTOM_SPEECH_PROVIDERS);
    const sttList = savedStt ? validateAndProcessCurlProviders(savedStt, "STT") : [];
    set({ customSttProviders: sttList, allSttProviders: computeAllStt(sttList) });

    // Selected AI provider
    const savedSelectedAi = safeLocalStorage.getItem(STORAGE_KEYS.SELECTED_AI_PROVIDER);
    if (savedSelectedAi) {
      set({ selectedAIProvider: JSON.parse(savedSelectedAi) });
    }

    // Selected STT provider
    const savedSelectedStt = safeLocalStorage.getItem(STORAGE_KEYS.SELECTED_STT_PROVIDER);
    if (savedSelectedStt) {
      set({ selectedSttProvider: JSON.parse(savedSelectedStt) });
    }

    // Customizable state
    const customizableState = getCustomizableState();
    set({ customizable: customizableState });
    updateCursor(customizableState.cursor.type || "invisible");

    const stored = safeLocalStorage.getItem(STORAGE_KEYS.CUSTOMIZABLE);
    if (!stored) {
      setCustomizableState(customizableState);
    } else {
      try {
        const parsed = JSON.parse(stored);
        if (!parsed.autostart) {
          setCustomizableState(customizableState);
          updateCursor(customizableState.cursor.type || "invisible");
        }
      } catch (error) {
        console.debug("Failed to check customizable state schema:", error);
      }
    }

    // Niuma API enabled
    const savedNiumaApiEnabled = safeLocalStorage.getItem(STORAGE_KEYS.Niuma_API_ENABLED);
    if (savedNiumaApiEnabled !== null) {
      set({ NiumaApiEnabled: savedNiumaApiEnabled === "true" });
    }

    // STT language
    const savedSttLanguage = safeLocalStorage.getItem(STORAGE_KEYS.STT_LANGUAGE);
    if (savedSttLanguage) {
      set({ sttLanguage: savedSttLanguage });
    }

    // STT translation
    const savedTranslationEnabled = safeLocalStorage.getItem(STORAGE_KEYS.STT_TRANSLATION_ENABLED);
    if (savedTranslationEnabled !== null) {
      set({ sttTranslationEnabled: savedTranslationEnabled === "true" });
    }
    const savedTranslationLanguage = safeLocalStorage.getItem(STORAGE_KEYS.STT_TRANSLATION_LANGUAGE);
    if (savedTranslationLanguage) {
      set({ sttTranslationLanguage: savedTranslationLanguage });
    }

    // User identity
    set({ userIdentity: getUserIdentity() });
  },

  setNiumaApiEnabled: (enabled) => {
    set({ NiumaApiEnabled: enabled });
    safeLocalStorage.setItem(STORAGE_KEYS.Niuma_API_ENABLED, String(enabled));
    get().loadData();
  },

  setHasActiveLicense: (update) => {
    set((s) => ({ hasActiveLicense: resolveUpdate(update, s.hasActiveLicense) }));
    // Sync license state to the backend (was a reactive effect).
    (async () => {
      try {
        await invoke("set_license_status", { hasLicense: get().hasActiveLicense });
        const config = getShortcutsConfig();
        await invoke("update_shortcuts", { config });
      } catch (error) {
        console.error("Failed to synchronize license state:", error);
      }
    })();
  },

  getActiveLicenseStatus: async () => {
    // License check bypassed - always active
    set({ hasActiveLicense: true });
    const autoConfigsEnabled = localStorage.getItem("auto-configs-enabled");
    if (!autoConfigsEnabled) {
      set({
        screenshotConfiguration: {
          mode: "auto",
          autoPrompt: "Analyze the screenshot and provide insights",
          enabled: false,
        },
      });
      localStorage.setItem("auto-configs-enabled", "true");
    }
  },

  setCursorType: (type) => {
    set((s) => ({ customizable: { ...s.customizable, cursor: { type } } }));
    updateCursor(type);
    updateCursorType(type);
    get().loadData();
  },

  setSttLanguage: (language) => {
    set({ sttLanguage: language });
    safeLocalStorage.setItem(STORAGE_KEYS.STT_LANGUAGE, language);
    get().loadData();
  },

  setSttTranslationEnabled: (enabled) => {
    set({ sttTranslationEnabled: enabled });
    safeLocalStorage.setItem(STORAGE_KEYS.STT_TRANSLATION_ENABLED, String(enabled));
    get().loadData();
  },

  setSttTranslationLanguage: (language) => {
    set({ sttTranslationLanguage: language });
    safeLocalStorage.setItem(STORAGE_KEYS.STT_TRANSLATION_LANGUAGE, language);
    get().loadData();
  },

  setUserIdentity: async (identity) => {
    set({ userIdentity: identity });
    saveUserIdentity(identity);
    // Invalidate AI context cache so new identity is picked up immediately
    const { invalidateContextCache } = await import("@/lib/functions/context-builder");
    invalidateContextCache();
    get().loadData();
  },
}));

/** Backwards-compatible hook: returns the full app store (like the old useApp). */
export const useApp = (): IContextType => useAppStore();

let appStoreInitialized = false;

/**
 * Bootstraps the one-time side-effects that used to live in AppProvider's
 * effects: initial load, license/app-start tracking, autostart, and listeners.
 */
export function initAppStore(): void {
  if (appStoreInitialized) return;
  appStoreInitialized = true;

  const store = useAppStore.getState();

  // Initial data load
  store.loadData();

  // License + app-start tracking
  (async () => {
    await store.getActiveLicenseStatus();
    try {
      await invoke("set_license_status", { hasLicense: useAppStore.getState().hasActiveLicense });
      const config = getShortcutsConfig();
      await invoke("update_shortcuts", { config });
    } catch (error) {
      console.error("Failed to synchronize license state:", error);
    }
    try {
      const appVersion = await invoke<string>("get_app_version");
      const storage = await invoke<{ instance_id: string }>("secure_storage_get");
      await trackAppStart(appVersion, storage.instance_id || "");
    } catch (error) {
      console.debug("Failed to track app start:", error);
    }
  })();

  // Apply customizable settings (icon visibility + always-on-top)
  (async () => {
    try {
      const { customizable } = useAppStore.getState();
      await Promise.all([
        invoke("set_app_icon_visibility", { visible: customizable.appIcon.isVisible }),
        invoke("set_always_on_top", { enabled: customizable.alwaysOnTop.isEnabled }),
        invoke("set_content_protected", { protected: customizable.contentProtected?.isEnabled ?? false }),
      ]);
    } catch (error) {
      console.error("Failed to apply customizable settings:", error);
    }
  })();

  // Autostart (only on first launch)
  (async () => {
    try {
      const autostartInitialized = safeLocalStorage.getItem(STORAGE_KEYS.AUTOSTART_INITIALIZED);
      if (!autostartInitialized) {
        const autostartEnabled = useAppStore.getState().customizable?.autostart?.isEnabled ?? true;
        if (autostartEnabled) {
          await enable();
        } else {
          await disable();
        }
        safeLocalStorage.setItem(STORAGE_KEYS.AUTOSTART_INITIALIZED, "true");
      }
    } catch (error) {
      console.debug("Autostart initialization skipped:", error);
    }
  })();

  // App icon hide/show listeners
  const handleAppIconVisibility = async (isVisible: boolean) => {
    try {
      await invoke("set_app_icon_visibility", { visible: isVisible });
    } catch (error) {
      console.error("Failed to set app icon visibility:", error);
    }
  };
  listen("handle-app-icon-on-hide", async () => {
    const currentState = getCustomizableState();
    if (!currentState.appIcon.isVisible) {
      await handleAppIconVisibility(false);
    }
  });
  listen("handle-app-icon-on-show", async () => {
    await handleAppIconVisibility(true);
  });

  // Cross-tab storage sync
  const handleStorageChange = (e: StorageEvent) => {
    if (
      e.key === STORAGE_KEYS.CUSTOM_AI_PROVIDERS ||
      e.key === STORAGE_KEYS.SELECTED_AI_PROVIDER ||
      e.key === STORAGE_KEYS.CUSTOM_SPEECH_PROVIDERS ||
      e.key === STORAGE_KEYS.SELECTED_STT_PROVIDER ||
      e.key === STORAGE_KEYS.SYSTEM_PROMPT ||
      e.key === STORAGE_KEYS.SCREENSHOT_CONFIG ||
      e.key === STORAGE_KEYS.CUSTOMIZABLE ||
      e.key === STORAGE_KEYS.STT_LANGUAGE ||
      e.key === STORAGE_KEYS.STT_TRANSLATION_ENABLED ||
      e.key === STORAGE_KEYS.STT_TRANSLATION_LANGUAGE ||
      e.key === STORAGE_KEYS.RESPONSE_SETTINGS ||
      e.key === STORAGE_KEYS.USER_IDENTITY
    ) {
      useAppStore.getState().loadData();
    }
  };
  window.addEventListener("storage", handleStorageChange);
}
