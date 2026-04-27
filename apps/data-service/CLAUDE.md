# data-service

Backend Cloudflare Worker for the Telegram notification hub: per-source `SchedulerDO`, `TelegramChannel` adapter, hourly self-alert cron, and Hono HTTP routes for source CRUD + reschedule + trigger + state.

## Structure

```
src/
├── index.ts                  # WorkerEntrypoint (fetch / scheduled / queue handlers)
├── channels/                 # NotificationChannel adapters (delivery layer)
│   ├── telegram.ts           # Real TG Bot API adapter (retry + dead-letter)
│   ├── db-delivery-logger.ts # Writes delivery_log / delivery_failures rows
│   └── serwer-sms.ts         # Legacy SMS adapter (kept for tests; not in production path)
├── domain/                   # Pure functions — no I/O
│   ├── notification.ts       # SourceData, ScheduleConfig, renderSourceToPayload, computeNextScheduledRun
│   ├── source-scheduling.ts  # computeNextAlarmForSource (waste / birthday dispatcher)
│   ├── source-lifecycle.ts   # createSourceWithTopic deps interface
│   ├── source-topic.ts       # getTopicMetadata (name + emoji per source type)
│   ├── system-topic.ts       # getOrCreateSystemTopicId (cached in KV)
│   ├── self-alert.ts         # handleSelfAlert (cron failure-threshold check)
│   ├── waste-collection-handler.ts  # renderMessage + computeNextAlarm (date list + DST)
│   └── birthday-handler.ts          # renderMessage + computeNextAlarm (yearly recurrence)
├── scheduler/
│   ├── scheduler-do.ts       # SchedulerDO — alarm()/triggerNow()/scheduleFromSource()/getState()
│   └── scheduler-do.workers.test.ts
└── hono/
    ├── app.ts                # Hono app: middleware + route registration
    ├── handlers/
    │   ├── sources.ts        # POST/PUT/DELETE /worker/sources, GET /:id/state, POST /:id/reschedule, POST /:id/trigger
    │   ├── health.ts         # GET /worker/health
    │   └── stats.ts          # GET /worker/stats (legacy KV cache, kept for compatibility)
    ├── middleware/           # request-id, error-handler, cors, rate-limit
    ├── services/
    │   ├── scheduled.ts      # Hourly cron — runs self-alert via TelegramChannel
    │   ├── queues.ts         # Drain-only legacy queue consumer (M2-P2 left it as no-op ack)
    │   ├── sms.ts            # Legacy SerwerSMS helper (orphan — not wired)
    │   └── cache-stats.ts    # Legacy KV stats cache (orphan — not wired)
    ├── types/                # Shared TS definitions
    └── utils/
        └── logger.ts         # Structured JSON logger (request-id-bound)
```

<important if="you need to run commands in apps/data-service/">

## Commands

```bash
pnpm dev              # wrangler dev on :8788 (env=dev)
pnpm deploy:stage     # wrangler deploy --env stage
pnpm deploy:prod      # wrangler deploy --env prod
pnpm test             # vitest (node pool — *.test.ts)
pnpm cf-typegen:dev   # regenerate types from wrangler.jsonc after binding changes
```

DO/Worker tests (`*.workers.test.ts`) run via `@cloudflare/vitest-pool-workers`. The repo-level `pnpm test` script runs both pools across the monorepo.

</important>

<important if="you need to understand the notification pipeline">

## Notification flow

Source created (admin UI or importer) → `notification_source` row + Telegram forum topic via `createSourceWithTopic` ([`src/domain/source-lifecycle.ts`](src/domain/source-lifecycle.ts)) → POST `/worker/sources/:id/reschedule` calls `SchedulerDO.scheduleFromSource(source, alertBeforeHours, timezone, deliveryTarget)` ([`src/scheduler/scheduler-do.ts`](src/scheduler/scheduler-do.ts)) → DO computes next alarm via `computeNextAlarmForSource` ([`src/domain/source-scheduling.ts`](src/domain/source-scheduling.ts)) and `setAlarm`s it.

When the alarm fires: DO loads source data + delivery target from storage, renders the payload via the type-specific handler (`waste-collection-handler` / `birthday-handler`), sends through `TelegramChannel` (which logs every attempt to `delivery_log` and dead-letters to `delivery_failures`), then recomputes the next date in the list and reschedules.

The `triggerNow` path (admin UI „Trigger now" button → `POST /worker/sources/:id/trigger`) uses the same render → channel pipeline but does not change the scheduled alarm.

</important>

<important if="you need to understand cron / scheduled handler">

## Cron — self-alert only

`triggers.crons` is wired for `0 * * * *` (hourly). The handler is [`src/hono/services/scheduled.ts`](src/hono/services/scheduled.ts) and it runs **only the M2-P7 self-alert**: counts `delivery_failures` from the last hour, if over threshold posts an alert to a „⚠️ System" forum topic via the same `TelegramChannel`. There is no longer any per-user scheduling cron — that was the pre-pivot SMS pipeline (now legacy).

</important>

<important if="you need to lazily construct the TelegramChannel inside SchedulerDO">

## SchedulerDO and channel construction

`SchedulerDO` keeps `channel: NotificationChannel | null = null` as a public field for test injection. In production, `resolveChannel()` lazily constructs a `TelegramChannel` from `env.TELEGRAM_BOT_TOKEN` on the first `alarm()` / `triggerNow()` call. Tests override by setting `instance.channel = new NoopChannel()` via `runInDurableObject` before invoking the alarm.

</important>

<important if="you need to configure wrangler bindings or secrets">

## Bindings + secrets

[`wrangler.jsonc`](wrangler.jsonc) binds (per env: dev / stage / prod):

- `SCHEDULER` — Durable Object namespace for `SchedulerDO` (one DO per source, named `source-${id}`)
- `CACHE` — KV namespace (used by self-alert `getOrCreateSystemTopicId`; legacy stats endpoint still uses the same binding)
- `NOTIFICATION_QUEUE` — legacy queue producer/consumer (drained, not used by current pipeline)
- `triggers.crons` — `0 * * * *`
- `routes` — `stage.powiadomienia.info/worker/*`, `powiadomienia.info/worker/*`

Secrets via `wrangler secret put` (or [`./sync-secrets.sh {env}`](sync-secrets.sh)):

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_CHAT_ID` — required for delivery
- `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` — Neon connection

After binding changes: `pnpm cf-typegen:dev` to regenerate `worker-configuration.d.ts`.

</important>

<important if="you're testing this worker locally with curl">

## Local testing tips

```bash
# Cron handler — fires self-alert path
curl "http://localhost:8788/__scheduled?cron=*+*+*+*+*"

# Reschedule a source (idempotent, returns DO state)
curl -X POST http://localhost:8788/worker/sources/1/reschedule

# Trigger now (sends a real TG message if secrets are set)
curl -X POST http://localhost:8788/worker/sources/1/trigger
```

The `triggerNow` handler auto-creates the forum topic if `topicId === null`, useful for backfilling sources imported with no TG creds in their local env file.

</important>

<important if="you encounter legacy / orphan code">

## Legacy artifacts

A few files survive from the pre-pivot SMS stack and are NOT in the current pipeline:

- [`src/channels/serwer-sms.ts`](src/channels/serwer-sms.ts) — kept because contract tests run against it; not wired into delivery
- [`src/hono/services/queues.ts`](src/hono/services/queues.ts) — drain-only queue consumer (M2-P2 turned it into a no-op ack)
- [`src/hono/services/sms.ts`](src/hono/services/sms.ts) — orphan SerwerSMS helper, not imported by any wired path
- [`src/hono/services/cache-stats.ts`](src/hono/services/cache-stats.ts) — orphan KV stats cache; the `/worker/stats` route still references it

When refactoring, prefer to delete these rather than extend them. The Telegram + SchedulerDO pipeline is the canonical path going forward.

</important>
