# Design Doc: Multilingual Interface (Polish + English)

## Overview

Implement i18n support for Polish (default) + English in TanStack Start application. Non-authenticated + authenticated users get language selector near theme toggle. Translates UI strings, DB enum values (waste_types.name, waste_schedules.month), notification messages. Excludes cities/streets. Uses react-i18next with localStorage + optional DB sync for auth users.

## Goals & Non-Goals

**Goals:**
- Support Polish (default) + English
- Locale detection: localStorage → browser locale → fallback EN
- Persistent preference: localStorage (all users) + DB (auth users)
- Translate: UI strings, waste_types.name, months, notifications
- Language selector in navigation-bar + account-dialog
- Server function locale awareness
- SSR-compatible solution

**Non-Goals:**
- Translating cities.name / streets.name (user-generated content)
- URL-based locale routing (/pl/, /en/)
- Dynamic locale switching beyond PL/EN
- RTL language support

## Context & Background

**Current State:**
- English-only UI
- Theme stored in localStorage + React Context (ThemeProvider pattern)
- TanStack Start with file-based routing, server functions
- Better Auth for authentication
- DB enums: waste_types.name (e.g., "Bio", "Plastic"), waste_schedules.month (Polish month names)
- Notifications sent via SMS (currently hardcoded Polish)

**Architecture Parallel:**
- Theme system: localStorage → Context → UI
- Language system: localStorage → DB (auth users) → Context → UI
- Both use dropdown selectors in navigation + account dialog

## Architecture Changes

### 1. Storage Strategy

**Three-Tier Storage:**

```
┌─────────────────────────────────────────────┐
│ Tier 1: localStorage (ALL users)           │
│ - Key: "ui-language" (matches theme key)   │
│ - Values: "pl" | "en"                       │
│ - Persists across sessions                  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Tier 2: DB (auth users ONLY)               │
│ - auth_user.preferredLanguage column        │
│ - Synced on change                          │
│ - Survives localStorage clear               │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Tier 3: React Context (runtime)            │
│ - LanguageProvider wraps app                │
│ - Provides: language, setLanguage, t        │
│ - Triggers i18next.changeLanguage()         │
└─────────────────────────────────────────────┘
```

**Detection Order (on mount):**
1. Check localStorage "ui-language"
2. If auth user exists, check auth_user.preferredLanguage (sync to localStorage if different)
3. Detect browser locale (navigator.language → extract "pl"/"en")
4. Fallback to "en"

### 2. Database Schema Change

**File:** `packages/data-ops/src/drizzle/auth-schema.ts`

```ts
export const auth_user = pgTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  phone: text("phone"),
  preferredLanguage: text("preferred_language").default("pl"), // NEW - matches "pl" | "en"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
```

**Migration Steps:**
```bash
cd packages/data-ops
pnpm run drizzle:dev:generate
pnpm run drizzle:dev:migrate
pnpm run build:data-ops
```

### 3. DB Enum Translation Strategy

**Problem:** waste_types.name currently stores Polish ("Bio", "Plastik"). Need display in both languages without changing DB.

**Selected Approach: Runtime Translation Map (Option C)**

Waste types and months are stable enums - runtime mapping avoids DB migration complexity.

```ts
// apps/user-application/src/lib/enum-translations.ts
export const WASTE_TYPE_MAP: Record<string, { pl: string; en: string }> = {
  "Bio": { pl: "Bio", en: "Bio" },
  "Plastik": { pl: "Plastik", en: "Plastic" },
  "Papier": { pl: "Papier", en: "Paper" },
  "Szkło": { pl: "Szkło", en: "Glass" },
  "Zmieszane": { pl: "Zmieszane", en: "Mixed Waste" },
};

export const MONTH_MAP: Record<string, { pl: string; en: string }> = {
  "styczeń": { pl: "Styczeń", en: "January" },
  "luty": { pl: "Luty", en: "February" },
  "marzec": { pl: "Marzec", en: "March" },
  "kwiecień": { pl: "Kwiecień", en: "April" },
  "maj": { pl: "Maj", en: "May" },
  "czerwiec": { pl: "Czerwiec", en: "June" },
  "lipiec": { pl: "Lipiec", en: "July" },
  "sierpień": { pl: "Sierpień", en: "August" },
  "wrzesień": { pl: "Wrzesień", en: "September" },
  "październik": { pl: "Październik", en: "October" },
  "listopad": { pl: "Listopad", en: "November" },
  "grudzień": { pl: "Grudzień", en: "December" },
};

export function translateWasteType(name: string, locale: "pl" | "en"): string {
  return WASTE_TYPE_MAP[name]?.[locale] || name;
}

export function translateMonth(month: string, locale: "pl" | "en"): string {
  return MONTH_MAP[month]?.[locale] || month;
}
```

**Pros:** No DB changes, fast implementation, type-safe
**Cons:** Tight coupling (acceptable for stable enums)

**Alternative Options Considered:**
- **Option A:** Translation keys in DB - cleaner but requires migration
- **Option B:** JSON columns - schema bloat, harder to maintain

### 4. Browser Locale Detection

**Strategy:** One-time detection on first visit, then only change on user demand.

**Detection Order (on mount):**
1. Check localStorage "ui-language" (user's explicit choice)
2. If auth user exists, check auth_user.preferredLanguage
3. **One-time only:** If neither exists, detect browser locale (navigator.language)
4. Fallback to "pl" (Polish default)

Once user explicitly changes language, browser detection is bypassed - localStorage takes precedence.

## Implementation Details

### 1. i18next Setup

**Install Dependencies:**
```bash
cd apps/user-application
pnpm add i18next react-i18next i18next-browser-languagedetector
```

**Create i18n Config:**
**File:** `apps/user-application/src/lib/i18n.ts`

```ts
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
```

### 2. Language Provider

**File:** `apps/user-application/src/components/language/language-provider.tsx`

```tsx
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
      updateUserLanguage(storedLang);
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
        await updateUserLanguage(newLang);
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
```

### 3. Language Selector Component

**File:** `apps/user-application/src/components/language/language-toggle.tsx`

```tsx
import * as React from "react";
import { Languages, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "./language-provider";
import { useTranslation } from "react-i18next";

interface LanguageToggleProps {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  align?: "start" | "center" | "end";
}

export function LanguageToggle({
  variant = "ghost",
  size = "default",
  align = "end",
}: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();

  const languageOptions = [
    {
      value: "pl" as const,
      label: "Polski",
    },
    {
      value: "en" as const,
      label: "English",
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className="gap-2 hover:scale-105 active:scale-95 transition-all"
          aria-label={t("language.toggle")}
        >
          <Languages className="h-4 w-4" />
          <span className="text-sm font-medium uppercase">{language}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="w-48 p-2 bg-popover/95 backdrop-blur-sm"
      >
        {languageOptions.map((option) => {
          const isSelected = language === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setLanguage(option.value)}
              className={`
                flex items-center gap-3 px-3 py-2.5 cursor-pointer
                transition-all rounded-md
                ${isSelected ? "bg-accent/60" : ""}
              `}
            >
              <span className="flex-1 text-sm font-medium">{option.label}</span>
              {isSelected && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 4. Server Function for DB Sync

**File:** `apps/user-application/src/core/functions/profile.ts` (add to existing)

```ts
import { createServerFn } from "@tanstack/react-start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import { getDb } from "@repo/data-ops/database/setup";
import { auth_user } from "@repo/data-ops/drizzle/auth-schema";
import { eq } from "drizzle-orm";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

export const updateUserLanguage = baseFunction
  .validator((language: string) => {
    if (language !== "pl" && language !== "en") {
      throw new Error("Invalid language");
    }
    return language;
  })
  .handler(async (ctx) => {
    const db = getDb();
    await db
      .update(auth_user)
      .set({ preferredLanguage: ctx.data })
      .where(eq(auth_user.id, ctx.context.userId));
    return { success: true };
  });
```

### 5. Translation Files Structure

**Directory:** `apps/user-application/src/locales/`

**File:** `apps/user-application/src/locales/en.json`

```json
{
  "nav": {
    "features": "Features",
    "documentation": "Documentation",
    "signIn": "Sign In",
    "signOut": "Sign Out",
    "account": "Account"
  },
  "theme": {
    "toggle": "Toggle theme",
    "light": "Light",
    "dark": "Dark",
    "system": "System"
  },
  "language": {
    "toggle": "Change language",
    "polish": "Polish",
    "english": "English"
  },
  "waste_type": {
    "bio": "Bio",
    "plastic": "Plastic",
    "paper": "Paper",
    "glass": "Glass",
    "mixed": "Mixed Waste"
  },
  "month": {
    "january": "January",
    "february": "February",
    "march": "March",
    "april": "April",
    "may": "May",
    "june": "June",
    "july": "July",
    "august": "August",
    "september": "September",
    "october": "October",
    "november": "November",
    "december": "December"
  },
  "notification": {
    "dayBefore": "Reminder: Tomorrow ({{date}}) waste collection in {{city}}: {{types}}.",
    "sameDay": "Today ({{date}}) waste collection in {{city}}: {{types}}."
  },
  "waste_schedule": {
    "title": "Waste Collection Schedule",
    "noSchedule": "No schedule available",
    "loading": "Loading schedule..."
  },
  "address": {
    "add": "Add Address",
    "edit": "Edit Address",
    "delete": "Delete Address",
    "city": "City",
    "street": "Street",
    "default": "Default Address"
  }
}
```

**File:** `apps/user-application/src/locales/pl.json`

```json
{
  "nav": {
    "features": "Funkcje",
    "documentation": "Dokumentacja",
    "signIn": "Zaloguj się",
    "signOut": "Wyloguj się",
    "account": "Konto"
  },
  "theme": {
    "toggle": "Zmień motyw",
    "light": "Jasny",
    "dark": "Ciemny",
    "system": "Systemowy"
  },
  "language": {
    "toggle": "Zmień język",
    "polish": "Polski",
    "english": "Angielski"
  },
  "waste_type": {
    "bio": "Bio",
    "plastic": "Plastik",
    "paper": "Papier",
    "glass": "Szkło",
    "mixed": "Zmieszane"
  },
  "month": {
    "january": "Styczeń",
    "february": "Luty",
    "march": "Marzec",
    "april": "Kwiecień",
    "may": "Maj",
    "june": "Czerwiec",
    "july": "Lipiec",
    "august": "Sierpień",
    "september": "Wrzesień",
    "october": "Październik",
    "november": "Listopad",
    "december": "Grudzień"
  },
  "notification": {
    "dayBefore": "Przypomnienie: Jutro ({{date}}) wywóz śmieci w {{city}}: {{types}}.",
    "sameDay": "Dzisiaj ({{date}}) wywóz śmieci w {{city}}: {{types}}."
  },
  "waste_schedule": {
    "title": "Harmonogram Wywozu Śmieci",
    "noSchedule": "Brak harmonogramu",
    "loading": "Ładowanie harmonogramu..."
  },
  "address": {
    "add": "Dodaj adres",
    "edit": "Edytuj adres",
    "delete": "Usuń adres",
    "city": "Miasto",
    "street": "Ulica",
    "default": "Domyślny adres"
  }
}
```

### 6. Integration in Root Layout

**File:** `apps/user-application/src/routes/__root.tsx` (update)

```tsx
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { LanguageProvider } from "@/components/language/language-provider"; // NEW
import "@/lib/i18n"; // NEW - initialize i18n

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="pl">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <ThemeProvider>
          <LanguageProvider> {/* NEW */}
            <Outlet />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### 7. Update Navigation Bar

**File:** `apps/user-application/src/components/navigation/navigation-bar.tsx` (update)

```tsx
import { ThemeToggle } from "@/components/theme";
import { LanguageToggle } from "@/components/language/language-toggle"; // NEW
import { useTranslation } from "react-i18next"; // NEW

export function NavigationBar() {
  const { t } = useTranslation(); // NEW
  // ... existing code

  const navigationItems: NavigationItem[] = [
    { label: t("nav.features"), href: "/#features", scrollTo: "features" }, // UPDATED
    { label: t("nav.documentation"), href: "/docs", isExternal: false }, // UPDATED
    // ...
  ];

  return (
    <nav>
      {/* Desktop Navigation */}
      <div className="hidden lg:flex items-center space-x-1">
        {/* ... existing nav items ... */}

        {/* Language + Theme Toggle */}
        <div className="ml-2 pl-2 border-l border-border/30 flex items-center gap-2">
          <LanguageToggle variant="ghost" align="end" /> {/* NEW */}
          <ThemeToggle variant="ghost" align="end" />
        </div>
      </div>

      {/* Mobile: add LanguageToggle before theme toggle */}
      <div className="lg:hidden flex items-center space-x-2">
        <LanguageToggle variant="ghost" align="end" /> {/* NEW */}
        <ThemeToggle variant="ghost" align="end" />
        {/* ... sheet menu ... */}
      </div>
    </nav>
  );
}
```

### 8. Update Account Dialog

**File:** `apps/user-application/src/components/auth/account-dialog.tsx` (update)

```tsx
import { LanguageToggle } from "@/components/language/language-toggle"; // NEW
import { Languages } from "lucide-react"; // NEW
import { useTranslation } from "react-i18next"; // NEW

export function AccountDialog({ children }: AccountDialogProps) {
  const { t } = useTranslation(); // NEW
  // ... existing code

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("nav.account")}</DialogTitle> {/* UPDATED */}
        </DialogHeader>
        {/* ... avatar ... */}
        <div className="flex flex-col gap-4 w-full mt-6">
          {/* Language selector */}
          <div className="flex items-center justify-between w-full py-3 px-4 rounded-lg border bg-card">
            <span className="text-sm font-medium flex items-center gap-2">
              <Languages className="h-4 w-4" />
              {t("language.toggle")}
            </span>
            <LanguageToggle />
          </div>

          {/* Theme selector (existing) */}
          <div className="flex items-center justify-between w-full py-3 px-4 rounded-lg border bg-card">
            <span className="text-sm font-medium flex items-center gap-2">
              <Palette className="h-4 w-4" />
              {t("theme.toggle")}
            </span>
            <ThemeToggle />
          </div>

          <Button onClick={signOut} variant="outline">
            <LogOut className="h-5 w-5" />
            {t("nav.signOut")} {/* UPDATED */}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 9. Server Function Locale Handling

**Pattern:** Pass locale as param to server functions that need translation:

**File:** `apps/user-application/src/core/functions/waste.ts` (update)

```ts
import { createServerFn } from "@tanstack/react-start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import { getWasteScheduleByUserId } from "@repo/data-ops/queries/waste";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

export const getMyWasteSchedule = baseFunction
  .validator((locale: string) => {
    if (!["pl", "en"].includes(locale)) throw new Error("Invalid locale");
    return locale;
  })
  .handler(async (ctx) => {
    const schedule = await getWasteScheduleByUserId(ctx.context.userId);
    // Server returns translation keys (e.g., "waste_type.bio", "month.january")
    // Client translates via t() in component
    return schedule;
  });
```

**Component Usage:**

```tsx
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/components/language/language-provider";
import { translateWasteType, translateMonth } from "@/lib/enum-translations";

export function WasteSchedule() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { data } = useQuery({
    queryKey: ["wasteSchedule", language],
    queryFn: () => getMyWasteSchedule(),
  });

  return (
    <div>
      <h2>{t("waste_schedule.title")}</h2>
      {data?.map(item => (
        <div key={item.id}>
          <p>{translateWasteType(item.wasteTypeName, language)}</p>
          <p>{translateMonth(item.month, language)}</p>
        </div>
      ))}
    </div>
  );
}
```


## Migration Path

### Phase 1: Infrastructure (non-breaking)
1. Add `preferredLanguage` column to auth_user (default "pl")
2. Install i18next dependencies
3. Create LanguageProvider + LanguageToggle components
4. Create translation files (en.json, pl.json)
5. Wrap app in LanguageProvider
6. Add language selector to navigation/account-dialog

**Status:** UI shows language selector, but text still hardcoded English

### Phase 2: UI Translation
1. Replace hardcoded strings with `t("key")` calls:
   - Navigation items
   - Button labels
   - Form labels
   - Error messages
2. Test language switching

**Status:** UI fully translated, DB enums still Polish-only

### Phase 3: DB Enum Translation
1. Create `packages/data-ops/src/lib/enum-translations.ts` with WASTE_TYPE_MAP and MONTH_MAP
2. Export translation helpers: `translateWasteType()`, `translateMonth()`
3. Update components to use translation helpers
4. Test enum translations in UI

**Status:** Complete i18n implementation for UI

## Alternatives Considered

### Alt 1: URL-Based Locale Routing (/pl/, /en/)
**Pros:** SEO-friendly, shareable localized links
**Cons:** Complexity with TanStack Router, not required (no public content to index)
**Rejected:** User preference persistence via localStorage simpler for SPA

### Alt 2: Separate i18n Package for Server
**Pros:** Consistent translation API across client + server
**Cons:** Bundle size, SSR complexity, overkill for SMS-only server translation
**Rejected:** Manual translation map on server sufficient

### Alt 3: Store All Translations in DB
**Pros:** Single source of truth, no code changes for new strings
**Cons:** Query overhead, cache complexity, difficult for dev workflow
**Rejected:** JSON files standard practice, version-controlled

## Security Considerations

1. **Locale Validation:** Server functions validate locale param ("pl"|"en" only)
2. **XSS Prevention:** react-i18next auto-escapes by default
3. **DB Injection:** Translation keys validated before DB updates
4. **localStorage Tampering:** Non-critical, fallback to default locale

## Performance Considerations

1. **Bundle Size:** Translation JSON files (~5KB each) loaded async
2. **localStorage Access:** Synchronous, negligible overhead
3. **DB Sync:** Single UPDATE query on language change (auth users only)
4. **SSR Compatibility:** i18next supports SSR, no hydration mismatch
5. **Query Invalidation:** Waste schedule queries keyed by `[entity, locale]`

## Resolved Decisions

✅ Language selector: Text-only (`Polski` / `English`), no flag emojis
✅ DB enum translation: Runtime mapping (Option C) - no DB migration
✅ Browser locale detection: One-time on first visit, then user demand only
✅ notification_logs: Don't store locale (not needed)

## Future Work / Dependencies

**SMS Notification Translation** - Blocked by [docs/003-notification-service.md](003-notification-service.md) implementation

When implementing doc 003, add:
- Locale param to `formatWasteNotification()` in `apps/data-service/src/services/sms.ts`
- User language fetch in queue consumer: `auth_user.preferredLanguage`
- Use shared `WASTE_TYPE_MAP` from `@repo/data-ops/lib/enum-translations`
- Template translations for day_before/same_day messages

## Critical Files

**New Files:**
- `apps/user-application/src/lib/i18n.ts` - i18next config
- `apps/user-application/src/components/language/language-provider.tsx` - Language context
- `apps/user-application/src/components/language/language-toggle.tsx` - Language selector UI
- `apps/user-application/src/locales/en.json` - English translations
- `apps/user-application/src/locales/pl.json` - Polish translations

**Updated Files:**
- `packages/data-ops/src/drizzle/auth-schema.ts` - Add preferredLanguage column
- `apps/user-application/src/core/functions/profile.ts` - Add updateUserLanguage
- `apps/user-application/src/routes/__root.tsx` - Wrap in LanguageProvider
- `apps/user-application/src/components/navigation/navigation-bar.tsx` - Add LanguageToggle
- `apps/user-application/src/components/auth/account-dialog.tsx` - Add LanguageToggle

**Shared Translation Module:**
- `packages/data-ops/src/lib/enum-translations.ts` - Enum translation maps + helpers (shared for future SMS use)

## Execution Order

1. DB schema: Add preferredLanguage column
2. Generate + apply migration
3. Rebuild data-ops
4. Install i18next deps
5. Create i18n config
6. Create LanguageProvider + LanguageToggle
7. Create translation files (placeholder keys)
8. Add updateUserLanguage server function
9. Update __root.tsx (wrap LanguageProvider)
10. Update navigation-bar (add LanguageToggle)
11. Update account-dialog (add LanguageToggle)
12. Populate translation files with actual strings
13. Replace UI strings with t() calls
14. Test language switching
15. Create enum-translations.ts in data-ops (WASTE_TYPE_MAP, MONTH_MAP)
16. Update components to use translation helpers
17. Test end-to-end UI translation
