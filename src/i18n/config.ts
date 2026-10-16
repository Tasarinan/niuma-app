import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enNavigation from "./locales/en/navigation.json";
import enDashboard from "./locales/en/dashboard.json";
import enPages from "./locales/en/pages.json";
import enErrors from "./locales/en/errors.json";

import zhCommon from "./locales/zh/common.json";
import zhNavigation from "./locales/zh/navigation.json";
import zhDashboard from "./locales/zh/dashboard.json";
import zhPages from "./locales/zh/pages.json";
import zhErrors from "./locales/zh/errors.json";

export const SUPPORTED_LOCALES = ["en", "zh"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

/** i18next + workspace `setting.json` UI language key */
export const LOCALE_STORAGE_KEY = "niuma-locale";

export const DEFAULT_APP_LOCALE: AppLocale = "zh";

const resources = {
  en: {
    common: enCommon,
    navigation: enNavigation,
    dashboard: enDashboard,
    pages: enPages,
    errors: enErrors,
  },
  zh: {
    common: zhCommon,
    navigation: zhNavigation,
    dashboard: zhDashboard,
    pages: zhPages,
    errors: zhErrors,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: DEFAULT_APP_LOCALE,
    fallbackLng: DEFAULT_APP_LOCALE,
    defaultNS: "common",
    fallbackNS: "common",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      // Product default is Chinese; only restore an explicit user choice.
      order: ["localStorage"],
      caches: ["localStorage"],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
    },
  });

export default i18n;
