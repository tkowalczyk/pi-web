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

// Get initial language - same logic as LanguageProvider to ensure SSR consistency
const getInitialLanguage = (): string => {
  if (typeof window === "undefined") return "pl";
  const stored = localStorage.getItem("ui-language");
  return (stored === "en" || stored === "pl") ? stored : "pl";
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS,
    lng: getInitialLanguage(),
    fallbackLng: "pl",
    supportedLngs: ["en", "pl"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "ui-language",
    },
  });

export default i18n;
