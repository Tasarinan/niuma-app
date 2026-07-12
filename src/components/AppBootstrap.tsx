import { useEffect, type ReactNode } from "react";
import { initThemeStore, initAppStore } from "@/store";

/**
 * Thin bootstrap that initializes the zustand theme store (applies persisted
 * theme/transparency and wires system + cross-tab listeners). Theme state lives
 * in `useThemeStore`; this component only runs the side-effects once.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initThemeStore();
  }, []);
  return <>{children}</>;
}

/**
 * Thin bootstrap that initializes the global app store (formerly AppContext).
 * Session state lives in `useAppStore`; this component only runs the one-time
 * side-effects (initial load, license/app-start tracking, autostart, listeners).
 */
export function AppProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initAppStore();
  }, []);
  return <>{children}</>;
}
