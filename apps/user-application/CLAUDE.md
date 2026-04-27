# user-application

Admin UI for the household notification hub — TanStack Start app for managing notification sources, household members, and viewing delivery log. Talks to `data-service` worker via service binding for source lifecycle operations (create source + topic, reschedule DO, trigger now).

## Structure

```
src/
├── routes/                    # File-based routing (generates routeTree.gen.ts)
│   ├── __root.tsx            # HTML shell, nav, devtools
│   ├── _auth/                # Protected route group (session-gated)
│   │   └── app/
│   │       ├── index.tsx     # Dashboard
│   │       ├── sources/      # List, create, edit notification sources
│   │       ├── members/      # Household member management
│   │       ├── settings/     # Household settings (timezone)
│   │       └── deliveries/   # Delivery log viewer
│   ├── auth/                 # Login, register, password reset
│   └── api/                  # API endpoints (auth callbacks, etc)
├── core/
│   ├── functions/            # Protected server functions (createServerFn)
│   │   ├── notification-sources.ts
│   │   ├── household-members.ts
│   │   ├── household-settings.ts
│   │   ├── delivery-log.ts
│   │   ├── profile.ts
│   │   └── session.ts
│   └── middleware/           # protectedFunctionMiddleware (session check)
├── components/
│   ├── ui/                   # Shadcn components (new-york style)
│   ├── sources/              # source-list, source-form, waste/birthday config fields, delete dialog
│   ├── members/              # household member CRUD
│   ├── settings/             # timezone form
│   ├── deliveries/           # delivery log table
│   ├── auth/                 # login/register/password forms
│   ├── navigation/, layout/  # dashboard nav + page shells
│   ├── language/             # i18n provider + switcher
│   └── theme/                # dark mode toggle
├── integrations/
│   └── tanstack-query/       # Query client + SSR integration
├── locales/                  # i18next pl/en JSON
└── lib/                      # shared utilities
```

<important if="you need to run commands in apps/user-application/">

## Commands

```bash
pnpm dev                    # vite dev on :3000
pnpm build:stage            # production build (stage mode)
pnpm build:prod             # production build (prod mode)
pnpm deploy:stage           # build + wrangler deploy --env=''
pnpm deploy:prod            # build + wrangler deploy --env=''
pnpm cf-typegen             # regenerate worker-configuration.d.ts
pnpx shadcn@latest add <c>  # add a Shadcn component
```

</important>

<important if="you're writing a server function">

## Server function pattern

Reference: [src/core/functions/profile.ts](src/core/functions/profile.ts)

Protected endpoints chain `protectedFunctionMiddleware` ([src/core/middleware/auth.ts](src/core/middleware/auth.ts)) — `ctx.context.userId` is populated post-auth, so the handler doesn't repeat session checks. For source lifecycle (create / update / delete / trigger), the function calls the `data-service` worker via `ctx.context.dataService.fetch(...)` so backend-side actions (topic creation, DO rescheduling) happen in one place — see [src/core/functions/notification-sources.ts](src/core/functions/notification-sources.ts) for the canonical wiring of POST + PUT + reschedule.

</important>

<important if="you're writing a form component">

## Form pattern

Reference: [src/components/sources/source-form.tsx](src/components/sources/source-form.tsx)

The convention is **uncontrolled inputs + FormData on submit**, paired with a `useMutation` calling the matching server function. No manual `useState` per field. Validation is delegated to the zod schema from `@repo/data-ops/zod-schema/*` — invalidate the query cache (`["notification-sources"]`, `["household-members"]`, etc.) on success to refresh the list.

</important>

<important if="you're touching authentication or auth-conditional UI">

## Auth specifics

- Client: [src/components/auth/client.ts](src/components/auth/client.ts) — Better Auth client instance
- Providers: email/password + Google OAuth
- Protected routes: nest under `_auth` ([src/routes/_auth/route.tsx](src/routes/_auth/route.tsx))
- Auth-conditional rendering: check `user.emailVerified !== undefined` before showing password-management UI (Google-only accounts have no credential to change)

</important>

<important if="you're working with routing">

## Routing

File structure auto-generates [src/routeTree.gen.ts](src/routeTree.gen.ts). Don't edit `routeTree.gen.ts` directly — add/rename a file under [src/routes/](src/routes/) and the dev server regenerates it. Router setup ([src/router.tsx](src/router.tsx)) wires TanStack Query + SSR context. Type-safe `<Link to="...">` is enforced from the generated tree.

</important>

<important if="you need to wire the data-service worker binding (service binding)">

## data-service service binding

`wrangler.jsonc` declares the `dataService` service binding pointing at `pi-web-data-service-{env}`. Server functions read it from `ctx.context.dataService` (set up in [src/server.ts](src/server.ts)). Calls go through `dataService.fetch(new Request("https://internal/worker/...", ...))` — the hostname is arbitrary; `internal` is just the convention. CF Vite plugin reads bindings only from the **top-level** `wrangler.jsonc` for local dev, so per-env overrides for the binding name must duplicate at the root level too.

</important>

<important if="you need to add a translation">

## Translations

i18next pl/en JSON in [src/locales/](src/locales/). Add a key to **both** `pl.json` and `en.json` under the appropriate section (e.g. `sources.*`, `deliveries.*`, `members.*`). Use `useTranslation()` in components — provide a fallback string: `t("sources.nextAlarm", "Najbliższy alarm")`.

</important>

<important if="you need to add or restyle a Shadcn component">

## UI components

Shadcn (new-york style, Tailwind v4) in [src/components/ui/](src/components/ui/). Add new primitives via `pnpx shadcn@latest add <c>`. Domain components (`sources/`, `members/`, `settings/`, `deliveries/`) compose primitives — keep them feature-scoped, don't dump shared UI helpers under a feature folder.

</important>
