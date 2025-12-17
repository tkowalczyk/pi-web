# Design Doc: Footer Component

## Overview

Footer component with copyright, legal links, HQ address, social icons. Supports i18n (EN/PL), appears on all routes, minimal design.

## Goals & Non-Goals

**Goals:**
- Dynamic copyright year (not hardcoded 2025)
- Links to Privacy Policy, Legal (parent), Terms, Cookie Policy
- HQ address display
- Social icons: X.com, LinkedIn, GitHub
- i18n support using existing translation infrastructure
- Responsive design (mobile + desktop)
- Globally available on all routes

**Non-Goals:**
- Newsletter signup / forms
- Multiple columns / complex layouts
- Footer navigation (beyond legal pages)
- Logo display (text-only copyright)

## Context & Background

**Current State:**
- Existing footer in `/apps/user-application/src/components/landing/footer.tsx`
- Demo footer links to TanStack/Backpine resources (to be replaced)
- i18n infrastructure already implemented (doc 006)
- Translation files: `src/locales/en.json`, `src/locales/pl.json`
- File-based routing in `src/routes/`

**Design Philosophy:**
- "Simple, readable, small" per requirements
- Match existing component patterns (Shadcn UI)
- Use existing Tailwind v4 utilities
- Follow established i18n patterns from doc 006

## Component Structure

### Footer Component

**File:** `/apps/user-application/src/components/landing/footer.tsx` (replace existing)

```tsx
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FaXTwitter, FaLinkedin, FaGithub } from "react-icons/fa6";

export function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const socialLinks = [
    {
      name: "X",
      href: "https://x.com/powiadomienia_info",
      icon: FaXTwitter,
    },
    {
      name: "LinkedIn",
      href: "https://linkedin.com/company/powiadomienia-info",
      icon: FaLinkedin,
    },
    {
      name: "GitHub",
      href: "https://github.com/powiadomienia-info",
      icon: FaGithub,
    },
  ];

  return (
    <footer className="border-t bg-background">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <div className="flex flex-col space-y-6 md:flex-row md:justify-between md:items-start md:space-y-0">
          {/* Left: Copyright + HQ */}
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {t("footer.copyright", { year: currentYear })}
            </p>
            <div className="text-xs text-muted-foreground">
              <p className="font-semibold mb-1">{t("footer.headquarters")}</p>
              <address className="not-italic">
                Harju maakond, Tallinn, Kesklinna linnaosa,<br />
                Narva mnt 13-27, 10151
              </address>
            </div>
          </div>

          {/* Center: Legal Links */}
          <nav className="flex flex-col space-y-2 text-sm">
            <Link
              to="/privacy-policy"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("footer.privacyPolicy")}
            </Link>
            <Link
              to="/legal"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("footer.legal")}
            </Link>
          </nav>

          {/* Right: Social Icons */}
          <div className="flex space-x-4">
            {socialLinks.map((link) => {
              const IconComponent = link.icon;
              return (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={link.name}
                >
                  <IconComponent className="h-4 w-4" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}
```

**Component Breakdown:**
- **Dynamic Year:** `new Date().getFullYear()` - updates automatically
- **i18n Integration:** Uses `t()` from `react-i18next`
- **Responsive Layout:** Vertical stack on mobile, horizontal on desktop
- **Small Text:** `text-sm` (14px) for main content, `text-xs` (12px) for address
- **Icons:** Small 16px (`h-4 w-4`) from `react-icons/fa6` (already installed)

## Data Model & i18n Structure

### Translation Keys

**File:** `/apps/user-application/src/locales/en.json` (add to existing)

```json
{
  "footer": {
    "copyright": "© powiadomienia.info is a product from Auditmos OU. All rights reserved {{year}}",
    "headquarters": "Headquarters",
    "privacyPolicy": "Privacy Policy",
    "legal": "Legal",
    "termsOfService": "Terms of Service",
    "cookiePolicy": "Cookie Policy"
  }
}
```

**File:** `/apps/user-application/src/locales/pl.json` (add to existing)

```json
{
  "footer": {
    "copyright": "© powiadomienia.info jest produktem Auditmos OU. Wszelkie prawa zastrzeżone {{year}}",
    "headquarters": "Siedziba",
    "privacyPolicy": "Polityka Prywatności",
    "legal": "Informacje Prawne",
    "termsOfService": "Regulamin",
    "cookiePolicy": "Polityka Cookies"
  }
}
```

**Translation Features:**
- `{{year}}` interpolation handled by i18next automatically
- Copyright text localizable (different phrasing for PL/EN)
- Address remains untranslated (official registered address)

## Routing Setup for Static Pages

### Route Structure

```
src/routes/
  privacy-policy.tsx       # Privacy Policy content
  legal.tsx                # Legal landing page with links
  terms-of-service.tsx     # Terms of Service content
  cookie-policy.tsx        # Cookie Policy content
```

### Static Page Template

**File:** `/apps/user-application/src/routes/privacy-policy.tsx`

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LandingNav } from "@/components/navigation/landing-nav";
import { Footer } from "@/components/landing/footer";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col">
      <LandingNav />
      <main className="flex-1 px-6 py-16 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">{t("footer.privacyPolicy")}</h1>
        <div className="prose prose-zinc dark:prose-invert max-w-none">
          {/* Content provided later */}
          <p className="text-muted-foreground">{t("staticPages.contentPlaceholder")}</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

**File:** `/apps/user-application/src/routes/legal.tsx`

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LandingNav } from "@/components/navigation/landing-nav";
import { Footer } from "@/components/landing/footer";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/legal")({
  component: LegalPage,
});

function LegalPage() {
  const { t } = useTranslation();

  const legalLinks = [
    { key: "termsOfService", path: "/terms-of-service" },
    { key: "cookiePolicy", path: "/cookie-policy" },
    { key: "privacyPolicy", path: "/privacy-policy" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <LandingNav />
      <main className="flex-1 px-6 py-16 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">{t("footer.legal")}</h1>
        <p className="text-muted-foreground mb-8">{t("staticPages.legalDescription")}</p>

        <div className="grid gap-4 md:grid-cols-2">
          {legalLinks.map((link) => (
            <Link key={link.key} to={link.path}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-lg">{t(`footer.${link.key}`)}</CardTitle>
                  <CardDescription>{t(`staticPages.${link.key}Description`)}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

**Other Static Pages:**
- `terms-of-service.tsx` - Same structure as privacy-policy
- `cookie-policy.tsx` - Same structure as privacy-policy

### Additional Translation Keys for Static Pages

```json
{
  "staticPages": {
    "contentPlaceholder": "Content will be provided soon.",
    "legalDescription": "Access our legal documents and policies.",
    "termsOfServiceDescription": "Terms governing use of our service",
    "cookiePolicyDescription": "How we use cookies on our website",
    "privacyPolicyDescription": "How we protect your personal data"
  }
}
```

## Layout Integration

### Global Footer Pattern

**Option A: Per-Route Integration (Selected)**

Footer added explicitly to each route layout. Provides flexibility for routes that may not need footer.

**Existing Layouts:**
- Landing page (`/`) - Uses `LandingNav` + content + Footer
- Dashboard (`/app/*`) - Uses `DashboardNav` + content + Footer
- Auth pages - May exclude footer (decision pending)

**Example Integration:**

**File:** `/apps/user-application/src/routes/index.tsx` (update existing)

```tsx
import { Footer } from "@/components/landing/footer";

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      {/* ... hero content ... */}
      <Footer />  {/* ADD */}
    </div>
  );
}
```

**File:** `/apps/user-application/src/routes/_auth/route.tsx` (auth layout)

```tsx
import { Footer } from "@/components/landing/footer";

function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <DashboardNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />  {/* ADD */}
    </div>
  );
}
```

**Option B: Root Layout Integration (Rejected)**

Placing footer in `__root.tsx` would force it on ALL routes including error pages, 404s, auth flows where it may be inappropriate.

## Styling Approach

### Design Tokens (Tailwind v4)

**Spacing:**
- Vertical padding: `py-8` (2rem / 32px) - compact
- Horizontal padding: `px-6` desktop, matches container pattern
- Max width: `max-w-7xl` - consistent with existing layouts

**Typography:**
- Main text: `text-sm` (14px) - small per requirements
- Address: `text-xs` (12px) - extra small for secondary info
- Color: `text-muted-foreground` - subtle, not distracting
- Hover: `hover:text-foreground` - subtle highlight

**Layout:**
- Mobile: `flex-col space-y-6` - vertical stack
- Desktop: `md:flex-row md:justify-between` - horizontal spread
- Icons: `space-x-4` - comfortable breathing room

**Borders:**
- Top border: `border-t` - subtle separation from content
- Background: `bg-background` - respects theme

### Responsive Behavior

**Mobile (< 768px):**
```
┌─────────────────────────┐
│ Copyright + HQ          │
│                         │
│ Privacy Policy          │
│ Legal                   │
│                         │
│ [X] [LinkedIn] [GitHub] │
└─────────────────────────┘
```

**Desktop (≥ 768px):**
```
┌────────────────────────────────────────────────┐
│ Copyright + HQ     Privacy Policy    [X] [LI]  │
│                    Legal             [GH]       │
└────────────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Footer Component
1. Update `/apps/user-application/src/components/landing/footer.tsx`
2. Add footer translation keys to `en.json` and `pl.json`
3. Test component in isolation (Storybook or direct import)

### Phase 2: Static Routes
1. Create `/apps/user-application/src/routes/privacy-policy.tsx`
2. Create `/apps/user-application/src/routes/legal.tsx`
3. Create `/apps/user-application/src/routes/terms-of-service.tsx`
4. Create `/apps/user-application/src/routes/cookie-policy.tsx`
5. Add static page translation keys
6. Verify routes render with placeholder content

### Phase 3: Layout Integration
1. Add Footer to landing page (`/src/routes/index.tsx`)
2. Add Footer to auth layout (`/src/routes/_auth/route.tsx`)
3. Verify footer appears on all intended routes
4. Test responsive behavior (mobile + desktop)

### Phase 4: Content Population (User to provide)
1. Replace placeholder content in static pages
2. Translate content for PL locale
3. Final review and testing

## Alternatives Considered

### Alt 1: Multi-Column Footer Layout
**Pros:** More space for links, common pattern
**Cons:** Requirements specify "simple, readable, small" - multi-column too heavy
**Rejected:** Overengineered for 4 links + address

### Alt 2: Centered Single Column
**Pros:** Ultra-minimal
**Cons:** Wastes horizontal space on desktop, poor UX for scanning
**Rejected:** 3-column spread better uses space while staying minimal

### Alt 3: Sticky Footer (always visible)
**Pros:** Legal links always accessible
**Cons:** Takes screen real estate, not standard for legal footers
**Rejected:** Normal footer scroll behavior expected

### Alt 4: Root Layout Footer (__root.tsx)
**Pros:** Single integration point, guaranteed on all routes
**Cons:** Appears on error pages, 404s, auth flows (may be inappropriate)
**Rejected:** Per-route integration provides flexibility

## Security Considerations

1. **External Links:** Social icons use `target="_blank" rel="noopener noreferrer"` to prevent tabnabbing
2. **XSS Prevention:** i18next auto-escapes, React JSX escapes by default
3. **Address Display:** Hardcoded (not user input), no injection risk
4. **Year Display:** `Date.getFullYear()` safe (no user input)

## Performance Considerations

1. **Bundle Size:** Footer component ~2KB, icons already installed (react-icons/fa6)
2. **Render Cost:** Static content, no API calls, negligible
3. **i18n Overhead:** Translation keys fetched once on mount (already loaded)
4. **Social Icon Assets:** SVG icons from react-icons (tree-shakeable)

## Dependencies

**Existing:**
- `react-i18next` - i18n infrastructure (doc 006)
- `react-icons/fa6` - Already installed for social icons
- `@tanstack/react-router` - Link component for internal nav

**New:**
- None (all dependencies already in project)

## Open Questions

**Q1:** Should auth pages (`/api/auth.$`) include footer?
- Decision: No (bare auth flows typically exclude footers)

**Q2:** Social media URLs - use real accounts or placeholder?
- Decision: Placeholder URLs provided, user to replace with real accounts

**Q3:** Should "Legal" page be separate or combine into Privacy Policy?
- Decision: Separate /legal parent page per requirements

**Q4:** Copyright link to Auditmos OU - internal page or external?
- Decision: External link to https://auditmos.ou per requirements

## Critical Files

**New Files:**
- `/apps/user-application/src/routes/privacy-policy.tsx` - Privacy Policy page
- `/apps/user-application/src/routes/legal.tsx` - Legal hub page
- `/apps/user-application/src/routes/terms-of-service.tsx` - Terms page
- `/apps/user-application/src/routes/cookie-policy.tsx` - Cookie Policy page

**Updated Files:**
- `/apps/user-application/src/components/landing/footer.tsx` - Replace demo footer
- `/apps/user-application/src/locales/en.json` - Add footer + staticPages keys
- `/apps/user-application/src/locales/pl.json` - Add footer + staticPages keys
- `/apps/user-application/src/routes/index.tsx` - Add Footer component
- `/apps/user-application/src/routes/_auth/route.tsx` - Add Footer component

## References

- [doc 006: Multilingual Interface](/Users/tkow/Documents/Code/powiadomienia-info/pi-web/docs/006-multilingual-interface.md) - i18n patterns
- [TanStack Router Docs](https://tanstack.com/router) - File-based routing
- [react-i18next](https://react.i18next.com/) - Translation API
- [Tailwind CSS v4](https://tailwindcss.com/) - Utility classes
