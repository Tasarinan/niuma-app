import { create } from "zustand";

const MODE_KEY = "niuma.appMode";

export type AppMode = "assistant" | "agent";

function getInitialMode(): AppMode {
  if (typeof window === "undefined") return "assistant";
  return localStorage.getItem(MODE_KEY) === "agent" ? "agent" : "assistant";
}

interface AppModeState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggle: () => void;
}

export const useAppModeStore = create<AppModeState>((set, get) => ({
  mode: getInitialMode(),
  setMode: (mode) => {
    localStorage.setItem(MODE_KEY, mode);
    set({ mode });
  },
  toggle: () => get().setMode(get().mode === "assistant" ? "agent" : "assistant"),
}));
