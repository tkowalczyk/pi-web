import * as React from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";
import { updateUserLanguage } from "@/core/functions/profile";

type Language = "pl" | "en";

type LanguageProviderState = {
  language: Language;
  setLanguage: (lang: Language) => void;
};

const LanguageProviderContext = React.createContext<LanguageProviderState | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const { data: session } = authClient.useSession();
  const [language, setLanguageState] = React.useState<Language>(() => {
    // SSR: return default
    if (typeof window === "undefined") return "pl";

    // Client: check localStorage
    const stored = localStorage.getItem("ui-language") as Language;
    return stored || "pl";
  });

  // Sync with DB on mount if auth user exists
  React.useEffect(() => {
    if (!session?.user) return;

    const userLang = session.user.preferredLanguage as Language | undefined;
    const storedLang = localStorage.getItem("ui-language") as Language | undefined;

    // DB has preference but localStorage doesn't → sync to localStorage
    if (userLang && !storedLang) {
      localStorage.setItem("ui-language", userLang);
      setLanguageState(userLang);
      i18n.changeLanguage(userLang);
    }
    // localStorage differs from DB → update DB (localStorage is source of truth)
    else if (storedLang && storedLang !== userLang) {
      updateUserLanguage({ data: { language: storedLang } });
    }
  }, [session?.user, i18n]);

  const setLanguage = React.useCallback(
    async (newLang: Language) => {
      // Update localStorage
      localStorage.setItem("ui-language", newLang);
      setLanguageState(newLang);
      i18n.changeLanguage(newLang);

      // Update DB if auth user
      if (session?.user) {
        await updateUserLanguage({ data: { language: newLang } });
      }
    },
    [i18n, session?.user]
  );

  return (
    <LanguageProviderContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageProviderContext.Provider>
  );
}

export const useLanguage = () => {
  const context = React.useContext(LanguageProviderContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};
