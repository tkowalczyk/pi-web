import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Translation files
import enTranslations from "@/locales/en.json";
import plTranslations from "@/locales/pl.json";

export const defaultNS = "translation";
export const resources = {
  en: { translation: enTranslations },
  pl: { translation: plTranslations },
} as const;

i18n
  .use(LanguageDetector) // Detect browser locale
  .use(initReactI18next) // React integration
  .init({
    resources,
    defaultNS,
    fallbackLng: "en",
    supportedLngs: ["en", "pl"],
    interpolation: {
      escapeValue: false, // React handles XSS
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "ui-language",
    },
  });

export default i18n;
