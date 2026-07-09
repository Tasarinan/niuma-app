import { useEffect } from "react";
import { useThemeStore, initThemeStore, type Theme } from "@/store";

type ThemeProviderProps = {
  children: React.ReactNode;
};

/**
 * Thin provider that initializes the zustand theme store (applies persisted
 * theme/transparency and wires system + cross-tab listeners). State now lives
 * in `useThemeStore`; this component only bootstraps the side-effects.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    initThemeStore();
  }, []);

  return <>{children}</>;
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
