# powiadomienia.info

Personal & family notification hub on Cloudflare Workers — Telegram alerts for waste pickups, birthdays, and other recurring events for one household.

## Architecture

```
apps/
├── user-application/    # TanStack Start admin UI (React 19)
│   └── CLAUDE.md       # Frontend-specific docs
├── data-service/        # Hono backend worker (SchedulerDO + TelegramChannel + cron self-alert)
│   └── CLAUDE.md       # Worker-specific docs
packages/
└── data-ops/            # Shared DB layer (schemas + queries + zod + importer)
    └── CLAUDE.md       # DB package docs
```

Each package has its own CLAUDE.md with detailed patterns:
- [apps/user-application/CLAUDE.md](apps/user-application/CLAUDE.md)
- [apps/data-service/CLAUDE.md](apps/data-service/CLAUDE.md)
- [packages/data-ops/CLAUDE.md](packages/data-ops/CLAUDE.md)

<important if="you need to understand the technology stack or pick dependencies">

## Stack

- **Frontend:** TanStack Start (Router + Query), React 19, Tailwind v4, Shadcn UI
- **Backend:** Cloudflare Workers (`WorkerEntrypoint`), Hono, Durable Objects (`SchedulerDO`)
- **Database:** Neon Postgres (Drizzle ORM)
- **Auth:** Better Auth (email/password + Google OAuth)
- **Delivery:** Telegram Bot API (HTML messages on per-source forum topics)
- **Tests:** Vitest (node pool for unit/domain) + `@cloudflare/vitest-pool-workers` (DO/Worker tests in `*.workers.test.ts`)
- **Lint + format:** Biome (single tool — no separate Prettier/ESLint)

</important>

<important if="you need to run commands to build, test, lint, or deploy">

## Commands

```bash
# Setup
pnpm setup                # Install deps + build data-ops (required first)

# Development
pnpm dev:user-application # Admin UI on :3000
pnpm dev:data-service     # Worker on :8788

# Testing & quality (from root)
pnpm test                 # All tests, local PGLite profile
pnpm test:ci              # All tests, managed Neon profile (CI)
pnpm lint:ci              # Biome ci
pnpm types                # Build data-ops + typecheck both apps

# Deployment (manual — see "Deployment" section)
pnpm deploy:stage:user-application
pnpm deploy:prod:user-application
pnpm deploy:stage:data-service
pnpm deploy:prod:data-service
```

Database commands live inside `packages/data-ops/`:

```bash
cd packages/data-ops
pnpm drizzle:{env}:generate   # Generate migration (dev/stage/prod)
pnpm drizzle:{env}:migrate    # Apply to env DB
pnpm drizzle:{env}:pull       # Pull schema from env DB
pnpm better-auth:generate     # Regenerate auth-schema.ts from config/auth.ts
pnpm seed:{env}               # Seed initial data (roles + household)
pnpm import:waste:{env}       # Import waste collection schedule from JSON
```

</important>

<important if="you need to build packages or apps">

## Build order

`data-ops` must be built first — both apps consume the compiled `dist/`. Run `pnpm setup` (one-time) or `pnpm build:data-ops` after schema/query changes. Apps then auto-reload.

Path alias per package: `@/*` → `src/*`.

</important>

<important if="you're modifying the database schema">

## Schema change workflow

1. Edit [packages/data-ops/src/drizzle/schema.ts](packages/data-ops/src/drizzle/schema.ts)
2. From `packages/data-ops/`: `pnpm drizzle:dev:generate` (only `dev` locally — stage/prod migrations run during deploy)
3. From `packages/data-ops/`: `pnpm drizzle:dev:migrate`
4. From root: `pnpm build:data-ops`
5. Apps auto-reload with new schema

</important>

<important if="you're adding a new feature end-to-end">

## Adding a feature

The canonical layering is `data-ops query → server function → useMutation hook` (see `.claude/CLAUDE.md`).

1. **DB schema** — [packages/data-ops/src/drizzle/schema.ts](packages/data-ops/src/drizzle/schema.ts)
2. **Query** — [packages/data-ops/src/queries/](packages/data-ops/src/queries/)
3. **Validation** — [packages/data-ops/src/zod-schema/](packages/data-ops/src/zod-schema/)
4. **Server function** — [apps/user-application/src/core/functions/](apps/user-application/src/core/functions/)
5. **UI component** — [apps/user-application/src/components/](apps/user-application/src/components/)

</important>

<important if="you need to deploy to stage or prod">

## Deployment

**Deploys are manual** — auto-deploy workflows were removed in M2 ("verify locally before pushing" policy). CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs lint + tests + types on PRs but does NOT deploy.

Manual deploy flow:

```bash
# 1. Build shared package
pnpm build:data-ops

# 2. Migrations (from packages/data-ops/)
pnpm drizzle:{env}:generate
pnpm drizzle:{env}:migrate

# 3. Deploy apps (from root)
pnpm deploy:stage:data-service       # or :prod
pnpm deploy:stage:user-application   # or :prod

# 4. Sync secrets if changed (from each app dir)
./sync-secrets.sh {env}
```

Per-app `wrangler.jsonc` holds bindings + routes (`stage.powiadomienia.info`, `powiadomienia.info`). Secrets via `wrangler secret put` per env. Migrations tracked separately per env in `packages/data-ops/src/drizzle/migrations/{dev,stage,prod}/`.

</important>

<important if="you need historical context, planning artifacts, or milestone state">

## Project state

Mid-pivot (2026-04+): from multi-tenant SaaS (SMS for waste collection) to single-household notification hub (Telegram + Durable Objects).

- M1 Fundament — **closed** ([prd](docs/prd-m1-fundament.md), [retro](docs/m1-retro.md))
- M2 Personal Notification Hub — **closed** ([prd](docs/prd-m2-notification-hub.md), [retro](docs/m2-retro.md))
- M3 Landing + Lead Capture — **stub** ([prd](docs/prd-m3-landing-lead-capture.md), [plan](plans/m3-landing-lead-capture.md))

Pre-pivot design docs live in [docs/archive/](docs/archive/) (SaaS multi-tenant auth, Stripe/BLIK, cities/streets schema, SMS service). **Do not consult by default** — they describe legacy behavior since refactored or removed. Only read when the user explicitly asks about legacy or past decisions.

</important>

<important if="you're touching authentication or the auth schema">

## Auth schema is generated

[packages/data-ops/src/drizzle/auth-schema.ts](packages/data-ops/src/drizzle/auth-schema.ts) is auto-generated from [packages/data-ops/config/auth.ts](packages/data-ops/config/auth.ts) via `pnpm better-auth:generate`. Don't edit `auth-schema.ts` directly — change `config/auth.ts` and regenerate.

</important>
