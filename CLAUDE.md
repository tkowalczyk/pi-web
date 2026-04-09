# powiadomienia.info

SMS notification system for Polish waste collection schedules. Users add addresses → receive automated SMS reminders.

## Architecture

Pnpm monorepo with shared DB layer deploying to Cloudflare Workers.

```
apps/
├── user-application/    # TanStack Start frontend (React 19)
│   └── CLAUDE.md       # Frontend-specific docs
├── data-service/        # Backend worker (cron + queues + SMS)
│   └── CLAUDE.md       # Worker-specific docs
packages/
└── data-ops/            # Shared DB layer (schemas + queries)
    └── CLAUDE.md       # DB package docs
```

**See package-specific CLAUDE.md for detailed patterns:**
- [apps/user-application/CLAUDE.md](apps/user-application/CLAUDE.md) - Frontend app (TanStack Start, auth, forms)
- [apps/data-service/CLAUDE.md](apps/data-service/CLAUDE.md) - Backend worker (notifications, cron, queues)
- [packages/data-ops/CLAUDE.md](packages/data-ops/CLAUDE.md) - DB layer (schemas, migrations, queries)

## Stack

- **Frontend:** TanStack Start (Router + Query), React 19, Tailwind v4, Shadcn UI
- **Backend:** Cloudflare Workers (WorkerEntrypoint), Hono, Queues, KV, Cron
- **Database:** Neon Postgres (Drizzle ORM)
- **Auth:** Better Auth (email/password + Google OAuth)
- **SMS:** SerwerSMS API

## Commands

### Setup
```bash
pnpm setup                # Install deps + build data-ops (required first)
```

### Development
```bash
pnpm dev:user-application # TanStack Start app (:3000)
pnpm dev:data-service     # Worker service (:8788)
```

### Deployment
```bash
pnpm deploy:stage:user-application   # Deploy frontend to stage
pnpm deploy:prod:user-application    # Deploy frontend to prod
pnpm deploy:stage:data-service       # Deploy worker to stage
pnpm deploy:prod:data-service        # Deploy worker to prod
```

### Database
```bash
cd packages/data-ops

# Migrations
pnpm drizzle:{env}:generate  # Generate migration (dev/stage/prod)
pnpm drizzle:{env}:migrate   # Apply to DB
pnpm drizzle:{env}:pull      # Pull schema from DB

# Auth schema
pnpm better-auth:generate    # Regenerate from config/auth.ts

# Data seeding
pnpm seed:{env}              # Seed initial data
pnpm import:{env}            # Clear + import from files
```

## Key Workflows

### Schema Changes
```bash
# 1. Edit packages/data-ops/src/drizzle/schema.ts
# 2. Generate migration
cd packages/data-ops
pnpm drizzle:dev:generate

# 3. Apply migration
pnpm drizzle:dev:migrate

# 4. Rebuild data-ops (from root or packages/data-ops/)
pnpm build:data-ops

# 5. Apps auto-reload with new schema
```

### Adding Features
1. **DB Schema** - Edit [packages/data-ops/src/drizzle/schema.ts](packages/data-ops/src/drizzle/schema.ts)
2. **Queries** - Add to [packages/data-ops/src/queries/](packages/data-ops/src/queries/)
3. **Validation** - Add Zod schemas to [packages/data-ops/src/zod-schema/](packages/data-ops/src/zod-schema/)
4. **Server Functions** - Add to [apps/user-application/src/core/functions/](apps/user-application/src/core/functions/)
5. **UI Components** - Add to [apps/user-application/src/components/](apps/user-application/src/components/)

## Design Docs

**Project is mid-pivot** (2026-04-09): from multi-tenant SaaS (SMS for waste collection) to personal/family notification hub (Telegram + Durable Objects + household model).

### Active planning artifacts
- **[docs/prd-m1-fundament.md](docs/prd-m1-fundament.md)** — M1 Fundament PRD (full, revised post-audit). Foundation refactor: test harness, TDD, remove multitenant, NotificationChannel abstraction, SchedulerDO scaffold, CI/CD. **Currently in progress.**
- **[docs/prd-m2-notification-hub.md](docs/prd-m2-notification-hub.md)** — M2 Personal Notification Hub (STUB, waiting for M1 retro)
- **[docs/prd-m3-landing-lead-capture.md](docs/prd-m3-landing-lead-capture.md)** — M3 Landing + Lead Capture (STUB, waiting for M2 retro)
- **[docs/saas-on-cf-delta.md](docs/saas-on-cf-delta.md)** — audit report: `saas-on-cf` template vs `pi-web` (12 areas, revised M1 sequencing)
- **[plans/m1-fundament.md](plans/m1-fundament.md)** — M1 tracer-bullet plan (8 phases)
- **[plans/m2-notification-hub.md](plans/m2-notification-hub.md)** — M2 plan (STUB)
- **[plans/m3-landing-lead-capture.md](plans/m3-landing-lead-capture.md)** — M3 plan (STUB)

GitHub milestones: `M1 Fundament` (active, 9 issues), `M2 Personal Notification Hub` (blocked), `M3 Landing + Lead Capture` (blocked).

### Historical design docs (archived)

Pre-pivot design documentation lives in **[docs/archive/](docs/archive/)**. Topics: SaaS multi-tenant auth, Stripe/BLIK payments, cities/streets schema, SMS notification service, etc. **Do not read by default** — these describe legacy behavior that is being refactored or removed. See [docs/archive/README.md](docs/archive/README.md) for index and context. Only consult archive when the user explicitly asks about legacy behavior or past decisions.

## Core Patterns

### data-ops Package
Central source of truth consumed by both apps:
- **Schemas:** [packages/data-ops/src/drizzle/](packages/data-ops/src/drizzle/)
- **Queries:** [packages/data-ops/src/queries/](packages/data-ops/src/queries/)
- **Auth:** [packages/data-ops/src/auth/](packages/data-ops/src/auth/)
- **Validation:** [packages/data-ops/src/zod-schema/](packages/data-ops/src/zod-schema/)

Must rebuild after changes: `pnpm build:data-ops`

### Environment Isolation
Migrations tracked separately per env:
- `packages/data-ops/src/drizzle/migrations/dev/`
- `packages/data-ops/src/drizzle/migrations/stage/`
- `packages/data-ops/src/drizzle/migrations/prod/`

Env files:
- `packages/data-ops/.env.dev` - Local development
- `packages/data-ops/.env.stage` - Staging
- `packages/data-ops/.env.prod` - Production

### Deployment
Both apps use Cloudflare Workers:
- Config: `wrangler.jsonc` per app
- Secrets: Via `wrangler secret put`
- Envs: Managed via `--env` flag (stage/prod)

## Dev Notes

- Monorepo: pnpm workspaces
- Build order: data-ops → apps (data-ops must build first)
- Path aliases: `@/*` → `src/*` (per package)
- Translations: i18next (pl/en) in [apps/user-application/src/locales/](apps/user-application/src/locales/)
- Auth schema: Auto-generated from [packages/data-ops/config/auth.ts](packages/data-ops/config/auth.ts) - don't edit `auth-schema.ts` manually
