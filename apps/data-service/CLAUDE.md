# data-service

Backend worker for long-running tasks: SMS notifications (cron + queues), coverage stats caching (KV).

## Stack

- **Cloudflare Worker** - WorkerEntrypoint pattern (fetch, scheduled, queue handlers)
- **Hono** - HTTP router for API endpoints
- **@repo/data-ops** - Shared DB layer (queries + schemas)
- **Queues** - SMS notification delivery with retries + DLQ
- **KV** - Coverage stats cache (cities/streets/users counts)
- **Cron** - Hourly trigger (0 * * * *) for notification scheduling

## Commands

```bash
pnpm dev              # Wrangler dev on :8788
pnpm deploy:stage     # Deploy to staging
pnpm deploy:prod      # Deploy to production
pnpm test:sms         # Test SMS sending (scripts/test-sms.ts)
pnpm cf-typegen:dev   # Generate types from wrangler.jsonc
```

## Structure

```
src/
├── index.ts           # WorkerEntrypoint (fetch, scheduled, queue)
├── hono/
│   └── app.ts        # HTTP router (/worker/health, /worker/stats)
├── scheduled/
│   └── index.ts      # Cron handler (queries users, queues SMS)
├── queues/
│   └── index.ts      # Queue consumer (sends SMS, logs results)
├── services/
│   └── sms.ts        # SerwerSMS API integration
└── kv/
    └── cache-stats.ts # Coverage stats caching
```

## Key Patterns

### WorkerEntrypoint Setup
**Location:** [src/index.ts](src/index.ts)

```typescript
export default class DataService extends WorkerEntrypoint<Env> {
  constructor(ctx: ExecutionContext, env: Env) {
    super(ctx, env);
    initDatabase({ /* env vars */ }); // Initialize DB connection
  }
  fetch(request: Request) { /* HTTP handler */ }
  async scheduled(controller: ScheduledController) { /* Cron handler */ }
  async queue(batch: MessageBatch<NotificationMessage>) { /* Queue consumer */ }
}
```

### Notification Flow
**Cron → Query → Queue → Send → Log**

1. **Scheduled** ([src/scheduled/index.ts](src/scheduled/index.ts)) - Runs hourly, queries users by notification hour, batches to queue
2. **Queue Consumer** ([src/queues/index.ts](src/queues/index.ts)) - Processes batches (10 msgs), sends SMS via SerwerSMS, logs to DB
3. **Idempotency** - Checks `notification_logs` before sending to prevent duplicates on retry
4. **Rate Limiting** - 200ms delay between sends (5 SMS/sec)

### KV Caching
**Pattern:** Stale-while-revalidate with fallback

[src/kv/cache-stats.ts](src/kv/cache-stats.ts) - Coverage stats cached 1hr, returns stale on error, fallback to hardcoded values

### Environment Bindings
**Config:** [wrangler.jsonc](wrangler.jsonc)

```jsonc
{
  "triggers": { "crons": ["0 * * * *"] },
  "queues": {
    "producers": [{ "queue": "notification-queue", "binding": "NOTIFICATION_QUEUE" }],
    "consumers": [{
      "queue": "notification-queue",
      "max_batch_size": 10,
      "max_batch_timeout": 5,
      "max_retries": 3,
      "dead_letter_queue": "notification-dlq"
    }]
  },
  "kv_namespaces": [{ "binding": "CACHE", "id": "..." }]
}
```

Secrets (via `wrangler secret put`):
- `SERWERSMS_API_TOKEN` - Required for SMS sending
- `SERWERSMS_SENDER_NAME` - Optional (SMS ECO if omitted, SMS FULL if provided)
- `DATABASE_*` - Host, username, password

## Design Docs

- [003-notification-service.md](../../docs/003-notification-service.md) - Full SMS notification architecture
- [008-coverage-stats-cache.md](../../docs/008-coverage-stats-cache.md) - KV caching strategy

## Dev Notes

- Path alias: `@/*` → `src/*`
- Queue testing: Local wrangler simulates queues in-memory
- Cron testing: `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"`
- SMS test mode: Set `test: true` in `sendSms()` body for free testing
- Types: Run `pnpm cf-typegen:dev` after wrangler config changes
- DB init: `initDatabase()` called in constructor, queries use `getDb()` from data-ops
