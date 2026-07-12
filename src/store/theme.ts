import { create } from "zustand";
import { STORAGE_KEYS } from "@/config";

export type Theme = "dark" | "light" | "system";

const mediaQuery =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem(STORAGE_KEYS.THEME) as Theme) || "system";
}

function getInitialTransparency(): number {
  if (typeof window === "undefined") return 10;
  const stored = localStorage.getItem(STORAGE_KEYS.TRANSPARENCY);
  return stored ? parseInt(stored, 10) : 10;
}

export function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  const root = window.document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "system") {
    root.classList.add(mediaQuery?.matches ? "dark" : "light");
  } else {
    root.classList.add(theme);
  }
}

export function applyTransparency(transparency: number) {
  if (typeof window === "undefined") return;
  const root = window.document.documentElement;
  const opacity = (100 - transparency) / 100;
  root.style.setProperty("--opacity", opacity.toString());
  root.style.setProperty(
    "--backdrop-blur",
    transparency > 0 ? "blur(12px)" : "none"
  );
}

interface ThemeState {
  theme: Theme;
  transparency: number;
  isSystemThemeDark: boolean;
  setTheme: (theme: Theme) => void;
  setTransparency: (transparency: number) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  transparency: getInitialTransparency(),
  isSystemThemeDark: mediaQuery?.matches ?? false,
  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    applyTheme(theme);
    set({ theme });
  },
  setTransparency: (transparency) => {
    localStorage.setItem(STORAGE_KEYS.TRANSPARENCY, transparency.toString());
    applyTransparency(transparency);
    set({ transparency });
  },
}));

let initialized = false;

/** Applies persisted theme/transparency and wires system + cross-tab listeners. Call once. */
export function initThemeStore() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const state = useThemeStore.getState();
  applyTheme(state.theme);
  applyTransparency(state.transparency);

  mediaQuery?.addEventListener("change", (e) => {
    useThemeStore.setState({ isSystemThemeDark: e.matches });
    if (useThemeStore.getState().theme === "system") {
      applyTheme("system");
    }
  });

  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEYS.THEME && e.newValue) {
      const theme = e.newValue as Theme;
      applyTheme(theme);
      useThemeStore.setState({ theme });
    }
    if (e.key === STORAGE_KEYS.TRANSPARENCY && e.newValue) {
      const transparency = parseInt(e.newValue, 10);
      applyTransparency(transparency);
      useThemeStore.setState({ transparency });
    }
  });
}

/** Backwards-compatible theme hook backed by the zustand theme store. */
export const useTheme = () => {
  const theme = useThemeStore((s) => s.theme);
  const transparency = useThemeStore((s) => s.transparency);
  const isSystemThemeDark = useThemeStore((s) => s.isSystemThemeDark);
  const setTheme = useThemeStore((s) => s.setTheme);
  const onSetTransparency = useThemeStore((s) => s.setTransparency);

  return {
    theme,
    setTheme,
    transparency,
    onSetTransparency,
    isSystemThemeDark,
  } as {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    transparency: number;
    onSetTransparency: (transparency: number) => void;
    isSystemThemeDark: boolean;
  };
};
