# powiadomienia.info — Agent Reference

## Architecture

Pnpm monorepo deploying to Cloudflare Workers. Deep modules — narrow interfaces, thick implementations.

```
apps/
├── user-application/    # TanStack Start frontend (React 19)
├── data-service/        # Backend worker (cron + queues + SMS)
packages/
├── data-ops/            # Shared DB layer (Drizzle ORM, Neon Postgres)
└── test-harness/        # Test utilities (PGLite/Neon dual-profile DB, fixtures)
```

## data-service: Layered Worker Structure

The backend worker uses a **layered Hono module** inside `apps/data-service/src/hono/`:

```
src/
├── index.ts                     # WorkerEntrypoint (fetch → Hono, scheduled, queue)
└── hono/
    ├── app.ts                   # Hono app: middleware wiring + route registration
    ├── handlers/                # HTTP request handlers (one file per endpoint group)
    │   ├── health.ts            # GET /worker/health
    │   └── stats.ts             # GET /worker/stats
    ├── middleware/               # Request/response interception
    │   ├── request-id.ts        # Assigns X-Request-Id, available via c.get("requestId")
    │   ├── error-handler.ts     # Catches errors → structured JSON { error, status, requestId }
    │   ├── cors.ts              # Environment-aware CORS policy
    │   └── rate-limit.ts        # In-memory IP-based rate limiting
    ├── services/                # Business logic and external integrations
    │   ├── sms.ts               # SerwerSMS API client
    │   ├── cache-stats.ts       # KV cache for coverage stats
    │   ├── scheduled.ts         # Cron handler: query users → queue notifications
    │   └── queues.ts            # Queue consumer: send SMS, log results
    ├── types/                   # Shared TypeScript definitions
    └── utils/                   # Helpers
        └── logger.ts            # Structured JSON logger bound to requestId
```

### Conventions

- **All worker code lives inside `hono/`**. No parallel `middleware/`, `services/`, or `utils/` directories at the `src/` level.
- **Middleware stack order**: request-id → CORS → rate-limit → handler. Error handler is registered via `app.onError()`.
- **Structured logging**: Use `createLogger(c.get("requestId"))` in handlers. Outputs JSON with `level`, `requestId`, `message`, `timestamp`.
- **Error responses**: Throw `HttpError(status, message)` for known errors. Unknown errors return `{ error: "Internal Server Error", status: 500, requestId }`.

## Import Boundaries

- `drizzle-orm` may only be imported inside `packages/data-ops/` and `packages/test-harness/`.
- Apps consume data-ops through its public exports (`@repo/data-ops/queries/*`, `@repo/data-ops/database/*`, etc.), never through internal paths.
- Enforced by CI tests in `packages/test-harness/tests/repo-hygiene.test.ts`.

## Build Order

`data-ops` → apps. Always rebuild data-ops after schema changes: `pnpm build:data-ops`.

## Testing

- `pnpm test` — fast local profile (PGLite, no network)
- `pnpm test:ci` — managed Postgres branch (Neon)
- Tests are co-located: `foo.test.ts` next to `foo.ts`
- Root `vitest.config.ts` aggregates all workspace projects
