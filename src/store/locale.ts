import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18n, { type AppLocale } from "@/i18n";

interface LocaleState {
  language: AppLocale;
  setLanguage: (lang: AppLocale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      language: (i18n.language?.startsWith("zh") ? "zh" : "en") as AppLocale,
      setLanguage: (lang) => {
        void i18n.changeLanguage(lang);
        set({ language: lang });
      },
    }),
    {
      name: "niuma-locale-store",
      partialize: (state) => ({ language: state.language }),
      onRehydrateStorage: () => (state) => {
        if (state?.language && i18n.language !== state.language) {
          void i18n.changeLanguage(state.language);
        }
      },
    }
  )
);
