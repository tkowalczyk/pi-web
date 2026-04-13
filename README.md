# powiadomienia.info

Web application that sends SMS messages about upcoming waste collection dates.

## Architecture

Monorepo using [pnpm workspace](https://pnpm.io/workspaces) with modular packages shared across apps:
- [apps/user-application](./apps/user-application/) - TanStack Start consumer-facing app
- [apps/data-service](./apps/data-service/) - Backend service for long-running tasks
- [packages/data-ops](./packages/data-ops/) - Shared DB layer (schemas, queries, auth)

Stack: [Better Auth](https://www.better-auth.com/docs/introduction), [Drizzle ORM](https://orm.drizzle.team/docs/overview), [Cloudflare Workers](https://developers.cloudflare.com/workers/), Neon Postgres.

## data-ops Package

Central shared package for all database operations. Both apps consume this package for type-safe DB access.

**Purpose**: Single source of truth for database schemas, queries, validations, and auth config.

### Directory Structure

#### `src/drizzle/`
Core database definitions using Drizzle ORM.

- **`schema.ts`** - Main application tables (cities, streets, addresses, notification_preferences)
- **`auth-schema.ts`** - Better Auth tables (auto-generated, don't edit manually)
- **`relations.ts`** - Drizzle relational queries config (defines joins between tables)
- **`migrations/{env}/`** - Migration history per environment (dev/stage/prod)

#### `src/queries/`
Reusable database operations exported as functions.

Example: `user.ts` exports `getUserProfile()`, `updateUserPhone()`

**Usage**: Import and call from apps - handles DB connection internally via `getDb()`.

```ts
import { getUserProfile } from "data-ops/queries/user";
const user = await getUserProfile(userId);
```

#### `src/zod-schema/`
API request/response validation schemas using Zod.

**Purpose**: Type-safe contracts between frontend/backend. Validates data shape at runtime.

Example: `user.ts` exports `UserProfileResponse` schema.

#### `src/database/`
- **`setup.ts`** - DB client initialization (`getDb()` function)
- **`seed/`** - Data seeding utilities (file loader, importer)

#### `src/auth/`
Better Auth configuration.
- **`setup.ts`** - Auth config (providers, plugins)
- **`server.ts`** - Auth server instance

### Workflow for New DB Features

1. **Add table** to `src/drizzle/schema.ts`
2. **Add relations** to `src/drizzle/relations.ts` (if needed)
3. **Generate migration**: `pnpm run drizzle:dev:generate`
4. **Apply migration**: `pnpm run drizzle:dev:migrate`
5. **Create queries** in `src/queries/{feature}.ts`
6. **Create Zod schemas** in `src/zod-schema/{feature}.ts`
7. **Rebuild package**: `pnpm run build:data-ops`
8. **Import in apps**: Use queries/schemas from both user-application and data-service

## Setup

```bash
pnpm run setup
```

Installs all dependencies and builds data-ops package.

## Development

```bash
pnpm run dev:user-application  # TanStack Start app (port 3000)
pnpm run dev:data-service      # Hono backend service
```

### Database Migrations

From `packages/data-ops/` directory:

```bash
pnpm run drizzle:dev:generate  # Generate migration
pnpm run drizzle:dev:migrate   # Apply to database
```

Replace `dev` with `stage` or `prod`. Migrations stored in `src/drizzle/migrations/{env}/`.

> **Note:** Stage/prod migrations run automatically in deploy workflows. Only run `dev` migrations locally.

### Environment Variables

Config files in `packages/data-ops/`:
- `.env.dev` - Local development
- `.env.stage` - Staging
- `.env.prod` - Production

Required:
```bash
DATABASE_HOST=
DATABASE_USERNAME=
DATABASE_PASSWORD=
```

## Deployment

Deployments are handled by GitHub Actions — **do not deploy manually**.

### Staging

Automatically deploys on every merge to `main` via [`.github/workflows/deploy-stage.yml`](.github/workflows/deploy-stage.yml).

Pipeline: install → build data-ops → generate DB migrations → apply migrations → deploy data-service → deploy user-application.

URL: https://stage.powiadomienia.info

### Production

Manual trigger only via [`.github/workflows/deploy-prod.yml`](.github/workflows/deploy-prod.yml) (requires reviewer approval in GitHub Actions tab).

Same pipeline as staging, targeting production DB and Cloudflare Workers.

URL: https://powiadomienia.info

### Required GitHub Secrets

Per environment (`stage` / `production`):

| Secret | Purpose |
|--------|---------|
| `DATABASE_HOST` | Neon Postgres host for migrations |
| `DATABASE_USERNAME` | Neon Postgres user for migrations |
| `DATABASE_PASSWORD` | Neon Postgres password for migrations |

Repository-level:

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Workers deploy |
| `CLOUDFLARE_ACCOUNT_ID` | Workers deploy |
| `NEON_API_KEY` | CI branch management |

Application secrets (Telegram, SerwerSMS, etc.) are managed via `wrangler secret put` per environment.

## Flow

### Hour matching happens BEFORE queuing:

1. Cron runs every hour (e.g., 8:00 AM CET, 9:00 AM CET, etc.)
2. Scheduled handler queries users where notification_preferences.hour = current_hour
    - 2.1 At 8:00 AM CET → only finds users with hour = 8
    - 2.2 At 9:00 AM CET → only finds users with hour = 9
3. Matched users get queued immediately
4. Queue consumer processes and sends SMS within seconds (not hours)

### Example Timeline:

7:59 AM CET - Cron hasn't run yet, nothing happens

8:00 AM CET - Cron runs

  └─ 8:00:01 - Query finds users with hour=8

  └─ 8:00:02 - Messages queued to NOTIFICATION_QUEUE
  
  └─ 8:00:03 - Queue consumer starts processing
  
  └─ 8:00:04 - SMS sent via SerwerSMS
  
  └─ 8:00:05 - Notification logged

9:00 AM CET - Cron runs again (different users with hour=9)