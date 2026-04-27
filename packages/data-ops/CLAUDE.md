# data-ops

Shared DB layer for both apps — single source of truth for schemas, queries, auth config, and zod validation. Compiled to `dist/` and consumed as a workspace package; changes here require a rebuild before apps see them.

## Structure

```
src/
├── drizzle/
│   ├── schema.ts             # Domain tables: households, household_members, household_roles,
│   │                         # notification_sources (inline JSONB config), channels,
│   │                         # delivery_log, delivery_failures
│   ├── auth-schema.ts        # Better Auth tables (auto-generated — don't edit)
│   ├── relations.ts          # Drizzle relational queries config
│   └── migrations/{env}/     # Per-env migration history (dev / stage / prod)
├── queries/
│   ├── household.ts          # Single-household get + timezone update
│   ├── household-members.ts  # Member CRUD
│   ├── notification-sources.ts  # Source CRUD + getActiveSourcesByHousehold
│   ├── channels.ts           # Channel CRUD
│   ├── delivery.ts           # Delivery log + failures (insert + recent queries)
│   └── user.ts               # User profile
├── zod-schema/
│   ├── notification-source.ts        # Source row response + Create/Update inputs
│   ├── waste-collection-config.ts    # Inline config validator for waste_collection
│   ├── birthday-config.ts            # Inline config validator for birthday
│   ├── source-form-schema.ts         # UI form schema + alertBeforeHours defaults per type
│   ├── household.ts, household-member.ts, channel.ts, delivery.ts, user.ts
│   └── (orphan: address.ts, phone.ts, stats.ts — pre-pivot, not imported anywhere current)
├── auth/
│   ├── setup.ts              # Better Auth config (providers + plugins)
│   ├── server.ts             # Auth server instance
│   └── facade.ts             # Public auth helpers
├── channels/                 # Channel port re-exports for adapters
├── database/
│   └── setup.ts              # initDatabase() + getDb() + resetDatabase() (test injection)
└── lib/
    └── enum-translations.ts  # Shared label maps
```

```
scripts/
├── seed.ts                   # Seed roles + household; idempotent
├── clear-data.ts             # Truncate domain tables (preserves auth_user)
└── import-waste-schedule/    # Modular importer (CLI entry: import-waste-schedule.ts)
    ├── input-schema.ts, transform.ts, parse-args.ts, filename.ts
    ├── importer.ts (DI orchestrator) + db-deps.ts (Drizzle adapter)
    └── *.test.ts (unit + PGLite integration)
```

<important if="you need to run commands in packages/data-ops/">

## Commands

```bash
pnpm build                    # Compile to dist/ (required after schema/query/zod changes)

# Migrations (per env)
pnpm drizzle:dev:generate     # Generate migration in src/drizzle/migrations/dev/
pnpm drizzle:dev:migrate      # Apply to dev DB
pnpm drizzle:dev:pull         # Pull schema from dev DB
# Same with :stage and :prod

# Auth schema regeneration (after editing config/auth.ts)
pnpm better-auth:generate

# Seeding & importing
pnpm seed:{env}               # Idempotent: roles + household
pnpm clear:{env}              # Truncate domain tables
pnpm import:waste:{env}       # Waste schedule importer (see section below)
```

</important>

<important if="you're writing a query">

## Query pattern

Queries live in [src/queries/](src/queries/) and use `getDb()` from [src/database/setup.ts](src/database/setup.ts) — the DB client is initialized once by the consuming app via `initDatabase({ host, username, password })` (or `initDatabase({ client })` in tests for PGLite injection). Reference: [src/queries/notification-sources.ts](src/queries/notification-sources.ts).

</important>

<important if="you're modifying the database schema">

## Migration workflow

1. Edit [src/drizzle/schema.ts](src/drizzle/schema.ts)
2. `pnpm drizzle:dev:generate` — creates SQL in `src/drizzle/migrations/dev/`
3. `pnpm drizzle:dev:migrate` — applies to local DB
4. `pnpm build` — recompile dist/; apps auto-reload

Each env keeps its own migration history (`migrations/dev/`, `migrations/stage/`, `migrations/prod/`) so dev experimentation doesn't collide with stage/prod state.

</important>

<important if="you're consuming data-ops from an app">

## Package exports

[`package.json`](package.json) exports:

```jsonc
{
  "./auth/*":       "./dist/auth/*.js",
  "./database/*":   "./dist/database/*.js",
  "./queries/*":    "./dist/queries/*.js",
  "./zod-schema/*": "./dist/zod-schema/*.js",
  "./channels/*":   "./dist/channels/*.js",
  "./lib/*":        "./dist/lib/*.js"
}
```

Apps import e.g. `@repo/data-ops/queries/notification-sources`, `@repo/data-ops/zod-schema/waste-collection-config`. Always rebuild data-ops after changes — apps consume the compiled `dist/`, not the source.

</important>

<important if="you need to configure environment files">

## Environment files

`packages/data-ops/.env.{dev,stage,prod}` (loaded by `dotenvx` for the migration / seed / import scripts):

```bash
DATABASE_HOST=
DATABASE_USERNAME=
DATABASE_PASSWORD=
TELEGRAM_BOT_TOKEN=        # optional locally; required for importer to create forum topics
TELEGRAM_GROUP_CHAT_ID=    # optional locally; required for importer to create forum topics
```

</important>

<important if="you're using or extending the waste schedule importer">

## Waste schedule importer

Imports `.data-to-import/raw/YYYY_N.json` into a `waste_collection` row in `notification_sources`. Per-env wrappers use the same `dotenvx` pattern as seed/clear. Full contract in [GitHub issue #28](https://github.com/tkowalczyk/pi-web/issues/28).

```bash
pnpm import:waste:dev   --file ../../.data-to-import/raw/2026_4.json --address "Nieporęt, ul. Agawy"
pnpm import:waste:stage --file ... --address "..." --scheduler-url https://stage.powiadomienia.info/worker
pnpm import:waste:prod  --file ... --address "..." --scheduler-url https://powiadomienia.info/worker

# Validate without DB
pnpm import:waste:dev --file ... --household-id 1 --dry-run
```

### Flags

- `--file <path>` (required)
- `--household-id <id>` (optional integer; defaults to single household; errors if 0 or >1)
- `--address "<label>"` (optional; defaults to `region` from input; used as both `notification_source.name` and `config.address`)
- `--year <YYYY>` (optional; overrides year parsed from filename)
- `--scheduler-url <url>` (optional; POSTs `/sources/:id/reschedule` after upsert to refresh the SchedulerDO)
- `--dry-run` (parse + validate only)

### Behavior

1. Read JSON → validate against [scripts/import-waste-schedule/input-schema.ts](scripts/import-waste-schedule/input-schema.ts).
2. Transform month-keyed `{ type → day[] }` → flat `WasteCollectionConfig` (`{ address, schedule: [{ type, dates: ["YYYY-MM-DD", ...] }] }`), sorted ASC. Validate against [src/zod-schema/waste-collection-config.ts](src/zod-schema/waste-collection-config.ts).
3. Resolve household.
4. Upsert with match key `(household_id, type='waste_collection', config.address)`:
   - **Insert** → `createForumTopic` via Telegram Bot API + store `topic_id`.
   - **Update** → also creates topic if `existing.topicId === null` (backfill).
5. If `--scheduler-url`, POST to refresh the DO. Otherwise admin UI Edit→Save (also wired) takes care of it.
6. Log structured summary.

### Tests

- Unit (mocked deps): [scripts/import-waste-schedule/](scripts/import-waste-schedule/) `transform`, `parse-args`, `filename`, `input-schema`, `importer`
- Integration (PGLite via `@repo/test-harness/db`): [scripts/import-waste-schedule/db-deps.test.ts](scripts/import-waste-schedule/db-deps.test.ts)

</important>

<important if="you're touching the auth schema">

## Auth schema is generated

[src/drizzle/auth-schema.ts](src/drizzle/auth-schema.ts) is auto-generated from [config/auth.ts](config/auth.ts) via `pnpm better-auth:generate`. Don't edit `auth-schema.ts` by hand — change `config/auth.ts` and regenerate.

</important>
