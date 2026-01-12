# user-application

SMS notification web app for Polish waste collection schedules. Users add addresses → receive SMS reminders via Better Auth + TanStack Start.

## Stack

- **TanStack Start** - SSR React framework (Router + Query integrated)
- **React 19** - Concurrent features enabled
- **Cloudflare Workers** - Deployment target
- **Better Auth** - Auth system (email/password + Google OAuth)
- **@repo/data-ops** - Shared DB layer (Drizzle + Neon Postgres)
- **i18next** - Translations (pl/en)
- **Shadcn UI** - Component library (Tailwind v4, new-york style)
- **Vite** - Build tool

## Commands

```bash
pnpm dev                    # Dev server on :3000
pnpm build:stage            # Build for staging
pnpm build:prod             # Build for production
pnpm deploy:stage           # Deploy to Cloudflare (stage)
pnpm deploy:prod            # Deploy to Cloudflare (prod)
pnpx shadcn@latest add <c>  # Add Shadcn component
```

## Structure

```
src/
├── routes/                 # File-based routing (generates routeTree.gen.ts)
│   ├── __root.tsx         # Root layout (HTML shell, nav, devtools)
│   ├── _auth/             # Protected routes (require auth)
│   │   └── app/           # Dashboard & user features
│   ├── auth/              # Auth routes (login, register)
│   └── api/               # API endpoints
├── core/
│   ├── functions/         # Server functions (protected by middleware)
│   └── middleware/        # Auth middleware (session checks)
├── components/
│   ├── ui/                # Shadcn components
│   ├── auth/              # Auth-specific (login, register, password)
│   ├── addresses/         # Address management
│   └── landing/           # Landing page components
└── integrations/
    └── tanstack-query/    # Query client setup + SSR integration
```

## Key Patterns

### Server Functions
**Location:** [src/core/functions/](src/core/functions/)

Protected endpoints using TanStack Start's `createServerFn()` + `protectedFunctionMiddleware`:

```typescript
// Example: src/core/functions/profile.ts
import { createServerFn } from "@tanstack/start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import { getUserProfile } from "data-ops/queries/user";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

export const getMyProfile = baseFunction.handler(async (ctx) => {
  return getUserProfile(ctx.context.userId); // userId from middleware
});
```

### Forms
**Pattern:** FormData + useMutation (NOT controlled inputs)

Reference: [src/components/addresses/address-form.tsx](src/components/addresses/address-form.tsx)

```typescript
const mutation = useMutation({ mutationFn: createMyAddress });
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
  mutation.mutate({ data: Object.fromEntries(formData) });
};
```

### Auth
**Client:** [src/components/auth/client.ts](src/components/auth/client.ts) - Better Auth client instance
**Providers:** Email/password + Google OAuth
**Protected Routes:** Use `_auth` route group ([src/routes/_auth/route.tsx](src/routes/_auth/route.tsx))

Check auth provider before showing features:
```typescript
const hasCredentialAccount = user.email && user.emailVerified !== undefined;
{hasCredentialAccount && <ChangePassword />} // Hide for OAuth-only users
```

### Routing
**Type-safe:** File structure generates [src/routeTree.gen.ts](src/routeTree.gen.ts)
**Router setup:** [src/router.tsx](src/router.tsx) - integrates TanStack Query context + SSR
**Root layout:** [src/routes/__root.tsx](src/routes/__root.tsx) - HTML shell, meta tags, nav

## Design Docs

Feature specs in [/docs/](../../docs/):
- [001-user-profile-and-addresses.md](../../docs/001-user-profile-and-addresses.md) - User profiles, address management, notification preferences
- [003-notification-service.md](../../docs/003-notification-service.md) - SMS notification system (cron + queues)
- [009-email-password-authentication.md](../../docs/009-email-password-authentication.md) - Auth implementation
- [IMPLEMENTATION_NOTES.md](../../docs/IMPLEMENTATION_NOTES.md) - Common mistakes & lessons learned

## Dev Notes

- Path alias: `@/*` → `src/*`
- Translations: [src/locales/](src/locales/) - use `useTranslation()` hook
- DB dependency: Changes to `@repo/data-ops` schema require rebuild (`pnpm run build:data-ops` from root)
- Wrangler config: [wrangler.jsonc](wrangler.jsonc) - Cloudflare Workers bindings
