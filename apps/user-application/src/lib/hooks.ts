import { useState, useCallback } from "react";

const TERMS_AGREED_KEY = "pi-terms-agreed";

export function useTermsAgreement() {
  const [agreedToTerms, setAgreedToTermsState] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(TERMS_AGREED_KEY) === "true";
    }
    return false;
  });

  const setAgreedToTerms = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setAgreedToTermsState((prev) => {
      const newValue = typeof value === "function" ? value(prev) : value;
      if (typeof window !== "undefined") {
        localStorage.setItem(TERMS_AGREED_KEY, String(newValue));
      }
      return newValue;
    });
  }, []);

  return [agreedToTerms, setAgreedToTerms] as const;
}
