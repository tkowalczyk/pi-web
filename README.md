# powiadomienia.info

Personal & family notification hub — Telegram alerts for waste pickups,
birthdays, and other recurring events for one household. Built on
Cloudflare Workers, Durable Objects, and TanStack Start.

> Project is mid-pivot (2026-04+): from multi-tenant SaaS (SMS for waste
> collection) to a single-household notification hub (Telegram +
> Durable Objects). Legacy SMS/queue flow archived; M2 milestone
> introduced TelegramChannel, SchedulerDO, and inline source config.

## What it does

- **Sources** → user adds a notification source (waste collection
  schedule, family birthdays, …) via the admin UI or import script.
- **Channel** → each source delivers through `TelegramChannel` (Bot API
  `sendMessage` with HTML + forum topic per source).
- **Scheduler** → one `SchedulerDO` per source computes the next alarm
  from inline JSONB config + `alertBeforeHours` + household timezone
  (DST-aware via `Intl`/`Temporal`).
- **Observability** → every send attempt logged in `delivery_log`;
  failures dead-lettered to `delivery_failures`; cron self-alert on
  threshold breach posts to a "⚠️ System" topic.

## Architecture

Pnpm monorepo deploying to Cloudflare Workers:

- [apps/user-application](./apps/user-application/) — TanStack Start admin UI (React 19, Better Auth)
- [apps/data-service](./apps/data-service/) — Hono backend, `SchedulerDO`, `TelegramChannel`, cron self-alert
- [packages/data-ops](./packages/data-ops/) — shared schemas, queries, zod validation, importer

Stack: TanStack Start · Cloudflare Workers · Durable Objects · Hono ·
Telegram Bot API · Neon Postgres · Drizzle ORM · Better Auth · TypeScript.

## Domain model

- `households` (single household, with `timezone`)
- `household_members` + `household_roles` (admin / member)
- `notification_sources` — `type`, `name`, inline `config` JSONB,
  `alertBeforeHours`, `topicId`. Source types validated by zod
  per type (`WasteCollectionConfig`, `BirthdayConfig`).
- `delivery_log` / `delivery_failures` — per-attempt observability.
- `auth_*` (Better Auth: email/password + Google OAuth).

Legacy `cities` / `streets` / `addresses` / `waste_schedules` /
`notification_preferences` tables were dropped in M2.

## Setup

```bash
pnpm setup                # install + build data-ops
```

## Development

```bash
pnpm dev:user-application # admin UI on :3000
pnpm dev:data-service     # worker on :8788
```

DB migrations (from `packages/data-ops/`):

```bash
pnpm drizzle:dev:generate  # generate migration
pnpm drizzle:dev:migrate   # apply to local DB
```

Replace `dev` with `stage` / `prod` for those environments.

### Environment files (per env)

`packages/data-ops/.env.{dev,stage,prod}`:

```bash
DATABASE_HOST=
DATABASE_USERNAME=
DATABASE_PASSWORD=
TELEGRAM_BOT_TOKEN=        # optional locally; set via wrangler secret in prod
TELEGRAM_GROUP_CHAT_ID=    # optional locally; set via wrangler secret in prod
```

## Importing waste schedules

```bash
pnpm import:waste:dev   --file ../../.data-to-import/raw/2026_4.json --address "City, ul. Street"
pnpm import:waste:stage --file ... --address "..."
pnpm import:waste:prod  --file ... --address "..."
```

Pass `--scheduler-url https://stage.powiadomienia.info/worker` to also
schedule the corresponding `SchedulerDO` after upsert. See
[`packages/data-ops/CLAUDE.md`](packages/data-ops/CLAUDE.md) for the
full importer contract.

## Deployment

Manual deploys from local machine (auto-deploy workflows were removed
during M2 — `verify locally before pushing` policy):

```bash
# Build first
pnpm build:data-ops

# Migrations (from packages/data-ops/)
pnpm drizzle:{env}:generate
pnpm drizzle:{env}:migrate

# Deploy apps (from root)
pnpm deploy:stage:data-service
pnpm deploy:stage:user-application
# or :prod for production
```

Stage: <https://stage.powiadomienia.info> · Prod: <https://powiadomienia.info>

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs lint,
tests, and typecheck on PRs and pushes to `main` — but does **not** deploy.

### Secrets (per environment)

Wrangler secrets per Worker:

- `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_CHAT_ID`

Set via `wrangler secret put` or `./sync-secrets.sh {env}` from each app
directory.

## Notification flow

```
Source created (UI / importer)
  → notification_source row + Telegram forum topic
  → SchedulerDO.scheduleFromSource(source, alertBeforeHours, timezone, target)
  → DO.alarm fires at: localMidnight(nextDate) − alertBeforeHours
  → render handler (waste / birthday / …) → NotificationPayload
  → TelegramChannel.send(payload) → delivery_log
  → DO.alarm reschedules itself for the next date in the list
```

For waste collection, "local midnight" is the household timezone (e.g.
Europe/Warsaw). With `alertBeforeHours=18` and a pickup on April 30, the
alarm fires on April 29 06:00 local time.

## Design docs

- [docs/prd-m1-fundament.md](docs/prd-m1-fundament.md) — M1 foundation refactor (test harness, channel port, SchedulerDO scaffold) — **closed**
- [docs/prd-m2-notification-hub.md](docs/prd-m2-notification-hub.md) — M2 personal notification hub (Telegram, waste, birthdays, admin UI) — **closed**
- [docs/prd-m3-landing-lead-capture.md](docs/prd-m3-landing-lead-capture.md) — M3 landing + lead capture — **stub**
- [docs/m1-retro.md](docs/m1-retro.md), [docs/m2-retro.md](docs/m2-retro.md) — milestone retros
- [docs/archive/](docs/archive/) — pre-pivot legacy design docs (do not consult by default)
