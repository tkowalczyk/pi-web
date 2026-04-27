# data-ops

Shared DB layer for all apps - single source of truth for schemas, queries, auth config, validation.

## Purpose

Central package consumed by user-application + data-service. Provides type-safe DB access, auth setup, validation schemas. Changes here require rebuild → apps auto-reload.

## Stack

- **Drizzle ORM** - Schema definition + migrations + queries
- **Neon Postgres** - Serverless database (@neondatabase/serverless)
- **Better Auth** - Auth schema (auto-generated from config)
- **Zod** - API validation schemas
- **TypeScript** - Compiled to `dist/`, exported as workspace package

## Commands

```bash
pnpm build                     # Compile to dist/ (required after changes)

# Migrations (from packages/data-ops/)
pnpm drizzle:{env}:generate    # Generate migration for env (dev/stage/prod)
pnpm drizzle:{env}:migrate     # Apply migration to env DB
pnpm drizzle:{env}:pull        # Pull schema from env DB

# Auth schema
pnpm better-auth:generate      # Regenerate auth-schema.ts from config/auth.ts

# Data seeding
pnpm seed:{env}                # Seed DB with initial data
pnpm import:{env}              # Clear + import from files

# Waste schedule importer
pnpm import:waste:{env} --file <path> [flags]
                               # Imports raw .data-to-import/raw/YYYY_N.json
                               # into a waste_collection notification_source.
                               # See "Waste schedule importer" section below.

# Debugging
pnpm debug:notifications:{env} <email|userId>  # Debug why user not receiving notifications
pnpm debug:schedules:{env} <cityId> <streetId> # Check waste schedules for city+street
```

## Structure

```
src/
├── drizzle/
│   ├── schema.ts          # App tables (cities, streets, addresses, etc)
│   ├── auth-schema.ts     # Better Auth tables (auto-generated - don't edit)
│   ├── relations.ts       # Drizzle relational queries config
│   └── migrations/        # Per-env migration history (dev/stage/prod/)
├── queries/
│   ├── user.ts                # User profile queries
│   ├── address.ts             # Address CRUD + city/street lookups
│   ├── notifications.ts       # Notification scheduling queries
│   ├── debug-notifications.ts # Debug query for notification issues
│   └── waste.ts               # Waste schedule queries
├── zod-schema/
│   ├── user.ts           # User validation schemas
│   └── stats.ts          # Coverage stats schemas
├── auth/
│   ├── setup.ts          # Better Auth config (providers, plugins)
│   └── server.ts         # Auth server instance
├── database/
│   ├── setup.ts                    # DB client (initDatabase, getDb)
│   ├── debug-user-notifications.ts # Debug script for notification issues
│   ├── debug-schedules.ts          # Debug script for waste schedules
│   └── seed/                       # Seeding utilities
└── lib/                   # Shared utilities
```

## Key Patterns

### Schema Definition
**Location:** [src/drizzle/schema.ts](src/drizzle/schema.ts)

```typescript
export const addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => auth_user.id, { onDelete: "cascade" }),
  cityId: integer("city_id").references(() => cities.id),
  // ...
}, (table) => [
  index("addresses_user_id_idx").on(table.userId),
]);
```

### Query Pattern
**Location:** [src/queries/*.ts](src/queries/)

Queries handle DB connection internally via `getDb()`:

```typescript
import { getDb } from "@/database/setup";
import { addresses } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getUserAddresses(userId: string) {
  const db = getDb();
  return await db.select().from(addresses).where(eq(addresses.userId, userId));
}
```

### Database Initialization
**Location:** [src/database/setup.ts](src/database/setup.ts)

Apps call `initDatabase()` once at startup, queries use `getDb()`:

```typescript
// In app (user-application or data-service)
import { initDatabase } from "@repo/data-ops/database/setup";
initDatabase({ host, username, password });

// In queries (data-ops)
import { getDb } from "@/database/setup";
const db = getDb(); // Throws if not initialized
```

### Migration Workflow
**Pattern:** Schema → Generate → Apply → Rebuild

```bash
# 1. Edit src/drizzle/schema.ts
# 2. Generate migration
cd packages/data-ops
pnpm drizzle:dev:generate  # Creates migration in src/drizzle/migrations/dev/

# 3. Apply migration
pnpm drizzle:dev:migrate

# 4. Rebuild package (from root or packages/data-ops/)
pnpm build

# 5. Apps auto-reload with new schema
```

## Exports

**Package exports** ([package.json](package.json)):
```json
{
  "exports": {
    "./auth/*": "./dist/auth/*.js",
    "./database/*": "./dist/database/*.js",
    "./queries/*": "./dist/queries/*.js",
    "./zod-schema/*": "./dist/zod-schema/*.js",
    "./lib/*": "./dist/lib/*.js"
  }
}
```

**Usage in apps:**
```typescript
import { getUserProfile } from "@repo/data-ops/queries/user";
import { loginSchema } from "@repo/data-ops/zod-schema/auth";
import { auth } from "@repo/data-ops/auth/server";
```

## Environment Files

```
.env.dev    # Local development DB
.env.stage  # Staging DB
.env.prod   # Production DB
```

Required vars:
```bash
DATABASE_HOST=
DATABASE_USERNAME=
DATABASE_PASSWORD=
```

## Design Docs

- [001-user-profile-and-addresses.md](../../docs/001-user-profile-and-addresses.md) - Address + notification preferences schema
- [002-cities-streets-database.md](../../docs/002-cities-streets-database.md) - Cities + streets schema
- [004-db-feeder.md](../../docs/004-db-feeder.md) - Data import from files

## Debug Scripts

### debug:notifications
Diagnoses why a user isn't receiving SMS notifications. Checks:
- Phone format (must be `+48XXXXXXXXX`)
- Subscription status + expiry
- Address has city + street assigned
- Notification preferences enabled + hour setting
- Waste schedules exist for user's city+street on today/tomorrow
- Hour mismatch (CET hour vs preference hour)

```bash
pnpm debug:notifications:dev user@example.com
# or
pnpm debug:notifications:dev userId123
```

### debug:schedules
Shows all waste schedules for a city+street combo. Useful for verifying data import.

```bash
pnpm debug:schedules:dev 41 469  # cityId streetId
```

## Waste schedule importer

Imports a raw region JSON file (`.data-to-import/raw/YYYY_N.json`) into a `waste_collection` row in `notification_sources`. Per-env wrappers use the same `dotenvx` pattern as seed/clear. See [GitHub issue #28](https://github.com/tkowalczyk/pi-web/issues/28) for the full contract.

```bash
# Dev / stage / prod
pnpm import:waste:dev   --file ../../.data-to-import/raw/2026_4.json --address "Nieporęt, ul. Agawy"
pnpm import:waste:stage --file ../../.data-to-import/raw/2026_4.json --address "Nieporęt, ul. Agawy"
pnpm import:waste:prod  --file ../../.data-to-import/raw/2026_4.json --address "Nieporęt, ul. Agawy"

# Validate without writing (no DB connection needed if --household-id is set)
pnpm import:waste:dev --file ... --household-id 1 --dry-run
```

### Flags

- `--file <path>` (required) — path to raw `YYYY_N.json`, relative to cwd
- `--household-id <id>` (optional, integer) — defaults to single household; errors if 0 or >1
- `--address "<label>"` (optional) — used as both `notification_source.name` and `config.address`; defaults to `region` from input
- `--year <YYYY>` (optional) — overrides year parsed from filename
- `--scheduler-url <url>` (optional) — base URL of `data-service` Worker. POSTs to `{url}/sources/:id/reschedule` after upsert. Skip to leave DO scheduling to admin UI „Edit → Save".
- `--dry-run` — parse + validate + log diff, no DB writes

### Behavior

1. Read JSON, validate against input zod schema (`scripts/import-waste-schedule/input-schema.ts`).
2. Transform `wasteCollectionSchedule` (month-keyed `{ type → day[] }`) into flat `WasteCollectionConfig` shape (`{ address, schedule: [{ type, dates: ["YYYY-MM-DD", ...] }] }`), sorted ASC.
3. Validate output against existing `WasteCollectionConfig` zod schema in [src/zod-schema/waste-collection-config.ts](src/zod-schema/waste-collection-config.ts).
4. Resolve household.
5. **Upsert** with match key `(household_id, type='waste_collection', config.address)`:
   - Insert new + `createForumTopic` via Telegram Bot API + store `topic_id`
   - Update config of existing match (no topic recreate)
6. If `--scheduler-url`, POST to refresh DO. Otherwise skip.
7. Log structured summary.

### Required env vars

- `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` — required for non-dry-run; loaded by `dotenvx` from `.env.{dev,stage,prod}`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_CHAT_ID` — optional; if unset, `createForumTopic` is skipped with a warning (the source row still gets inserted)

### Tests

- Unit (mocked deps): `scripts/import-waste-schedule/{transform,parse-args,filename,input-schema,importer}.test.ts`
- Integration (PGLite via `@repo/test-harness`): `scripts/import-waste-schedule/db-deps.test.ts`

## Dev Notes

- Path alias: `@/*` → `src/*`
- Build output: `dist/` (gitignored, apps import from here)
- Auth schema: Auto-generated from `config/auth.ts` - don't edit `auth-schema.ts` manually
- Migration isolation: Each env has separate migration history (prevents stage/prod conflicts)
- Always rebuild after schema changes: Apps won't see changes until `pnpm build` completes
