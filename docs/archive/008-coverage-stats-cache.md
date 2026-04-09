# Design Doc: Coverage Stats Cache with Cloudflare KV

## Overview

**STATUS: ✅ IMPLEMENTED**

Cache system for landing page coverage statistics (cities count, streets count, waste schedules count, active users count) using Cloudflare KV. On-demand refresh strategy: first request after 2h TTL expiry triggers DB query + cache update. Subsequent requests served from edge cache. Public API endpoint at `/worker/stats` with CORS support and X-Cache-Status headers.

## Architecture Flow

### High-Level Components
```
Landing Page (user-application)
  ↓ (HTTP GET request)
data-service /worker/stats endpoint
  ↓ (check KV cache)
Cloudflare KV (CACHE)
  ↓ (if cache miss/expired)
Neon Postgres (count queries via data-ops)
  ↓ (cache result with 2h TTL)
KV (cached for 2h)
  ↓ (return JSON with X-Cache-Status header)
Landing Page (display 4 stats cards)
```

**Primitives Used:**
- **Cloudflare KV** - Global edge cache with TTL
- **Hono API** - GET /worker/stats endpoint
- **On-demand refresh** - No cron needed

### Detailed Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ USER REQUEST (Landing page load)                                │
│ - Browser fetches: GET https://{env}/worker/stats              │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ DATA-SERVICE /worker/stats ENDPOINT                             │
│ 1. DB initialized in WorkerEntrypoint constructor (index.ts)   │
│ 2. Try KV cache: env.CACHE.get("coverage-stats")               │
│ 3. KV checks TTL internally:                                    │
│    - If data exists + TTL not expired → return cached data      │
│    - If data missing OR TTL expired → return null               │
│ 4. CORS middleware checks origin (env-aware)                    │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ CACHE HIT PATH (cached data valid)                             │
│ - Return JSON immediately                                       │
│ - Add header: X-Cache-Status: HIT                               │
│ - Response time: ~50-100ms (edge cache)                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ CACHE MISS PATH (first request or expired)                     │
│ 1. DB already initialized in WorkerEntrypoint constructor      │
│ 2. Query counts in parallel:                                    │
│    - getCitiesCount() → SELECT COUNT(*) FROM cities            │
│    - getStreetsCount() → SELECT COUNT(*) FROM streets          │
│    - getWasteSchedulesCount() → SELECT COUNT(*) FROM ...       │
│    - getActiveUsersCount() → SELECT COUNT(*) FROM auth_user    │
│ 3. Build stats object:                                          │
│    { citiesCount, streetsCount, wasteSchedulesCount,           │
│      activeUsersCount, lastUpdated: ISO timestamp,             │
│      expiresAt: ISO timestamp (now + 2h) }                     │
│ 4. Store in KV with TTL:                                        │
│    kv.put(key, JSON.stringify(stats), { expirationTtl: 7200 }) │
│ 5. Return JSON with header: X-Cache-Status: MISS               │
│ - Response time: ~500-1500ms (DB query + cache write)          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ERROR PATH (DB unavailable)                                     │
│ 1. Try to get stale cache (may fail if TTL expired + deleted)  │
│ 2. If stale data exists → return with X-Cache-Status: STALE    │
│ 3. Ultimate fallback → hardcoded values with header:            │
│    X-Cache-Status: FALLBACK                                     │
│    { citiesCount: 5, streetsCount: 1987,                       │
│      wasteSchedulesCount: 0, activeUsersCount: 0,              │
│      expiresAt: current timestamp }                             │
└─────────────────────────────────────────────────────────────────┘

TTL BEHAVIOR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
T+0h   → First request: Cache miss (X-Cache-Status: MISS), query DB, cache for 2h
T+30m  → Request: Cache hit (X-Cache-Status: HIT), instant response from KV
T+1h   → Request: Cache hit (X-Cache-Status: HIT), instant response from KV
T+1.5h → Request: Cache hit (X-Cache-Status: HIT), instant response from KV
T+2h   → Request: KV returns null (TTL expired), query DB, recache (X-Cache-Status: MISS)
T+2.5h → Request: Cache hit (refreshed) (X-Cache-Status: HIT), instant response

STALE CACHE STRATEGY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DB query fails + cache expired → Try kv.get() for stale data
- May return null (KV auto-deleted after TTL)
- May return stale data (if deletion not yet propagated)
- If stale exists → return with X-Cache-Status: STALE
- If no stale → return hardcoded fallback with X-Cache-Status: FALLBACK
```

---

## 1. Database Queries

**STATUS: ✅ IMPLEMENTED**

### 1.1 Count Queries
**File:** `packages/data-ops/src/queries/address.ts` (updated)

```ts
import { count } from "drizzle-orm";
import { getDb } from "@/database/setup";
import { cities, streets, wasteSchedules, auth_user } from "@/drizzle/schema";

export async function getCitiesCount() {
  const db = getDb();
  const [result] = await db.select({ count: count() }).from(cities);
  return result.count;
}

export async function getStreetsCount() {
  const db = getDb();
  const [result] = await db.select({ count: count() }).from(streets);
  return result.count;
}

export async function getWasteSchedulesCount() {
  const db = getDb();
  const [result] = await db.select({ count: count() }).from(wasteSchedules);
  return result.count;
}

export async function getActiveUsersCount() {
  const db = getDb();
  const [result] = await db.select({ count: count() }).from(auth_user);
  return result.count;
}
```

### 1.2 Rebuild data-ops
```bash
cd packages/data-ops
pnpm run build:data-ops
```

---

## 2. Zod Schema

**STATUS: ✅ IMPLEMENTED**

### 2.1 Coverage Stats Schema
**File:** `packages/data-ops/src/zod-schema/stats.ts` (created)

```ts
import { z } from "zod";

export const CoverageStatsResponse = z.object({
  citiesCount: z.number(),
  streetsCount: z.number(),
  wasteSchedulesCount: z.number(),
  activeUsersCount: z.number(),
  lastUpdated: z.string().datetime(),
  expiresAt: z.string().datetime(), // Added in implementation
});

export type CoverageStatsResponse = z.infer<typeof CoverageStatsResponse>;
```

---

## 3. Cloudflare KV Setup

**STATUS: ✅ IMPLEMENTED**

### 3.1 Create KV Namespaces
```bash
# Dev environment
npx wrangler kv:namespace create "CACHE" --preview

# Stage environment
npx wrangler kv:namespace create "CACHE" --env stage

# Prod environment
npx wrangler kv:namespace create "CACHE" --env prod
```

**IMPLEMENTATION NOTE:** KV binding name is `CACHE`, not `COVERAGE_STATS`.

### 3.2 Update Wrangler Config
**File:** `apps/data-service/wrangler.jsonc` (updated)

**ACTUAL IMPLEMENTATION:**
```jsonc
{
  "name": "pi-web-data-service",
  "main": "./src/index.ts",
  "compatibility_date": "2025-04-01",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true
  },
  "env": {
    "dev": {
      "kv_namespaces": [
        {
          "binding": "CACHE",
          "id": "eed883194c594bf8ac25811ec3d37751",
          "remote": true
        }
      ]
    },
    "stage": {
      "routes": [
        {
          "zone_name": "powiadomienia.info",
          "pattern": "stage.powiadomienia.info/worker/*"
        }
      ],
      "name": "pi-web-data-service-stage",
      "kv_namespaces": [
        {
          "binding": "CACHE",
          "id": "eb683052a4dd40b3a87d212c23b36c0c",
          "remote": false
        }
      ]
    },
    "prod": {
      "routes": [
        {
          "zone_name": "powiadomienia.info",
          "pattern": "powiadomienia.info/worker/*"  // Fixed in implementation
        }
      ],
      "name": "pi-web-data-service-prod",
      "kv_namespaces": [
        {
          "binding": "CACHE",
          "id": "7688a332f25e416795f71a004b557f65",
          "remote": false
        }
      ]
    }
  }
}
```

### 3.3 Update Worker Types
**File:** `apps/data-service/worker-configuration.d.ts` (auto-generated by wrangler)

**ACTUAL IMPLEMENTATION:**
```ts
interface Env {
  CACHE: KVNamespace; // Binding name is CACHE
  CLOUDFLARE_ENV: string;
  CLOUDFLARE_ENV_STAGE_ADDRESS: string; // For CORS
  CLOUDFLARE_ENV_PROD_ADDRESS: string; // For CORS
  DATABASE_HOST: string;
  DATABASE_USERNAME: string;
  DATABASE_PASSWORD: string;
}
```

---

## 4. Cache Utils

**STATUS: ✅ IMPLEMENTED**

### 4.1 Cache Helper Functions
**File:** `apps/data-service/src/lib/cache-stats.ts` (created)

**ACTUAL IMPLEMENTATION:**
```ts
import {
  getCitiesCount,
  getStreetsCount,
  getWasteSchedulesCount,
  getActiveUsersCount,
} from "@repo/data-ops/queries/address";
import type { CoverageStatsResponse } from "@repo/data-ops/zod-schema/stats";

const CACHE_KEY = "coverage-stats";
const TTL_SECONDS = 7200; // 2 hours (NOT 24h)

export async function refreshCoverageStats(kv: KVNamespace): Promise<CoverageStatsResponse> {
  const [citiesCount, streetsCount, wasteSchedulesCount, activeUsersCount] = await Promise.all([
    getCitiesCount(),
    getStreetsCount(),
    getWasteSchedulesCount(),
    getActiveUsersCount(),
  ]);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_SECONDS * 1000);

  const stats: CoverageStatsResponse = {
    citiesCount,
    streetsCount,
    wasteSchedulesCount,
    activeUsersCount,
    lastUpdated: now.toISOString(),
    expiresAt: expiresAt.toISOString(), // Added in implementation
  };

  await kv.put(CACHE_KEY, JSON.stringify(stats), { expirationTtl: TTL_SECONDS });

  return stats;
}

export async function getCoverageStats(kv: KVNamespace): Promise<CoverageStatsResponse | null> {
  const cached = await kv.get(CACHE_KEY, "json");
  return cached as CoverageStatsResponse | null;
}
```

---

## 5. API Endpoint

**STATUS: ✅ IMPLEMENTED**

### 5.1 Database Initialization
**File:** `apps/data-service/src/index.ts` (updated)

**IMPLEMENTATION NOTE:** DB initialized in WorkerEntrypoint constructor, not in endpoint.

```ts
import { WorkerEntrypoint } from "cloudflare:workers";
import { app } from "@/hono/app";
import { initDatabase } from "@repo/data-ops/database/setup";

export default class DataService extends WorkerEntrypoint<Env> {
  constructor(ctx: ExecutionContext, env: Env) {
    super(ctx, env)
    initDatabase({
      host: env.DATABASE_HOST,
      username: env.DATABASE_USERNAME,
      password: env.DATABASE_PASSWORD,
    })
  }
  fetch(request: Request) {
    return app.fetch(request, this.env, this.ctx);
  }
}
```

### 5.2 Stats Endpoint with CORS
**File:** `apps/data-service/src/hono/app.ts` (updated)

**ACTUAL IMPLEMENTATION:**
```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCoverageStats, refreshCoverageStats } from "@/kv/cache-stats";
import type { CoverageStatsResponse } from "@repo/data-ops/zod-schema/stats";

export const app = new Hono<{ Bindings: Env }>();

// CORS middleware with env-aware origin checking
app.use("/*", cors({
  origin: (origin, c) => {
    const env = c.env.CLOUDFLARE_ENV;
    if (env === "dev") return origin;
    if (env === "stage" && origin === c.env.CLOUDFLARE_ENV_STAGE_ADDRESS) return origin;
    if (env === "prod" && origin === c.env.CLOUDFLARE_ENV_PROD_ADDRESS) return origin;
    return null;
  }
}));

app.get("/worker", (c) =>
  c.json({
    name: "powiadomienia.info Worker",
    version: "0.0.1",
    description: "powiadomienia.info is a web application that sends SMS messages about upcoming waste collection dates.",
    vars: {
      cloudflare_dev: c.env.CLOUDFLARE_ENV
    }
  }),
);

// Stats endpoint with X-Cache-Status headers
app.get("/worker/stats", async (c) => {
  try {
    let stats = await getCoverageStats(c.env.CACHE);

    if (!stats) {
      stats = await refreshCoverageStats(c.env.CACHE);
      c.header("X-Cache-Status", "MISS");
    } else {
      c.header("X-Cache-Status", "HIT");
    }

    return c.json(stats);
  } catch (error) {
    // Try stale cache
    try {
      const staleStats = await c.env.CACHE.get("coverage-stats", "json");
      if (staleStats) {
        c.header("X-Cache-Status", "STALE");
        return c.json(staleStats as CoverageStatsResponse);
      }
    } catch (staleError) {
      console.error("[stats] Stale cache also unavailable:", staleError);
    }

    // Ultimate fallback
    const now = new Date();
    c.header("X-Cache-Status", "FALLBACK");
    return c.json<CoverageStatsResponse>({
      citiesCount: 5,
      streetsCount: 1987,
      wasteSchedulesCount: 0,
      activeUsersCount: 0,
      lastUpdated: now.toISOString(),
      expiresAt: now.toISOString(),
    });
  }
});
```

---

## 6. Frontend Integration

**STATUS: ✅ IMPLEMENTED**

### 6.1 Environment Variables

**IMPLEMENTATION NOTE:** Using `.dev.vars` for local dev (not `.env`).

**Local dev:** `apps/user-application/.dev.vars`

```bash
VITE_DATA_SERVICE_URL=http://localhost:8788
# For local testing against data-service dev server
```

**Local data-service dev port:** `8788` (not 3000)

### 6.2 Landing Page Update
**File:** `apps/user-application/src/routes/index.tsx` (updated)

**ACTUAL IMPLEMENTATION:**
```tsx
import { useQuery } from "@tanstack/react-query";
import type { CoverageStatsResponse } from "@repo/data-ops/zod-schema/stats";

function LandingPage() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const isLoggedIn = !!session?.user;

  const { data: stats } = useQuery<CoverageStatsResponse>({
    queryKey: ["coverageStats"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_DATA_SERVICE_URL}/worker/stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
    placeholderData: {
      citiesCount: 12,
      streetsCount: 1200,
      wasteSchedulesCount: 0,
      activeUsersCount: 0,
      lastUpdated: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
    },
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LandingNav />
      <section className="flex-1 relative px-6 lg:px-8 pt-32 pb-12">
        <div className="mx-auto max-w-5xl">
          {/* ... hero section ... */}

          {/* Coverage Stats - 4 cards implemented */}
          <div className="mb-16">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-foreground mb-2">
                {t("landing.coverage")}
              </h2>
              <p className="text-muted-foreground">{t("landing.coverageDescription")}</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
              <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-transparent">
                <CardContent className="pt-6 text-center">
                  <div className="text-5xl font-bold text-primary mb-2">
                    {stats?.citiesCount ?? 12}
                  </div>
                  <div className="text-lg text-muted-foreground">{t("landing.cities")}</div>
                </CardContent>
              </Card>
              <Card className="border-primary/20 bg-gradient-to-br from-secondary/10 to-transparent">
                <CardContent className="pt-6 text-center">
                  <div className="text-5xl font-bold text-primary mb-2">
                    {stats?.streetsCount.toLocaleString() ?? "1,200+"}
                  </div>
                  <div className="text-lg text-muted-foreground">{t("landing.streets")}</div>
                </CardContent>
              </Card>
              <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-transparent">
                <CardContent className="pt-6 text-center">
                  <div className="text-5xl font-bold text-primary mb-2">
                    {stats?.wasteSchedulesCount.toLocaleString() ?? "0"}
                  </div>
                  <div className="text-lg text-muted-foreground">{t("landing.wasteSchedules")}</div>
                </CardContent>
              </Card>
              <Card className="border-primary/20 bg-gradient-to-br from-secondary/10 to-transparent">
                <CardContent className="pt-6 text-center">
                  <div className="text-5xl font-bold text-primary mb-2">
                    {stats?.activeUsersCount.toLocaleString() ?? "0"}
                  </div>
                  <div className="text-lg text-muted-foreground">{t("landing.activeUsers")}</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
```

**IMPLEMENTATION NOTES:**
- 4 stats cards (cities, streets, wasteSchedules, activeUsers)
- Grid: `md:grid-cols-2 lg:grid-cols-4` for responsive layout
- i18n keys added: `landing.wasteSchedules`, `landing.activeUsers`

---

## 7. Deployment

**STATUS: ✅ IMPLEMENTED**

### 7.1 Required Secrets

**data-service secrets (.dev.vars):**
```bash
DATABASE_HOST=...
DATABASE_USERNAME=...
DATABASE_PASSWORD=...
CLOUDFLARE_ENV=dev
CLOUDFLARE_ENV_STAGE_ADDRESS=https://stage.powiadomienia.info
CLOUDFLARE_ENV_PROD_ADDRESS=https://powiadomienia.info
```

**Stage/Prod secrets (via wrangler secrets):**
```bash
npx wrangler secret put DATABASE_HOST --env stage
npx wrangler secret put DATABASE_USERNAME --env stage
npx wrangler secret put DATABASE_PASSWORD --env stage
npx wrangler secret put CLOUDFLARE_ENV --env stage
npx wrangler secret put CLOUDFLARE_ENV_STAGE_ADDRESS --env stage
npx wrangler secret put CLOUDFLARE_ENV_PROD_ADDRESS --env stage

# Repeat for prod
```

### 7.2 Deployment Steps

```bash
# 1. Build data-ops
cd packages/data-ops
pnpm run build:data-ops
cd ../..

# 2. Deploy data-service
pnpm run deploy:stage:data-service

# 3. Test API endpoint
curl https://stage.powiadomienia.info/worker/stats
# Check X-Cache-Status header: MISS on first request, HIT on second

# Expected output:
# {
#   "citiesCount": 5,
#   "streetsCount": 1987,
#   "wasteSchedulesCount": 0,
#   "activeUsersCount": 0,
#   "lastUpdated": "2025-12-18T10:30:00.000Z",
#   "expiresAt": "2025-12-18T12:30:00.000Z"
# }

# 4. Deploy user-application
pnpm run deploy:stage:user-application

# 5. Verify landing page displays 4 stats cards

# 6. Repeat for prod
pnpm run deploy:prod:data-service
pnpm run deploy:prod:user-application
```

---

## 8. Testing Flow

**STATUS: ✅ IMPLEMENTED**

### 8.1 Local Testing

**Prerequisites:**
- `.dev.vars` in `apps/data-service/` with DB credentials + CORS env vars
- `.dev.vars` in `apps/user-application/` with `VITE_DATA_SERVICE_URL=http://localhost:8788`

**Steps:**
1. Start data-service: `cd apps/data-service && pnpm run dev` (port 8788)
2. Test stats endpoint: `curl -i http://localhost:8788/worker/stats`
   - Check X-Cache-Status header: MISS on first request
3. Test again: `curl -i http://localhost:8788/worker/stats`
   - Check X-Cache-Status header: HIT on second request
4. Start user-application: `cd apps/user-application && pnpm run dev` (port 3000)
5. Open landing page: http://localhost:3000
6. Verify 4 stats cards display correctly

**Cache Testing:**
1. First request → X-Cache-Status: MISS (DB query)
2. Second request → X-Cache-Status: HIT (KV cached)
3. Wait 2h or delete KV key → X-Cache-Status: MISS (refresh)

### 8.2 Production Testing

1. Deploy to stage
2. Test API: `curl -i https://stage.powiadomienia.info/worker/stats`
   - Check X-Cache-Status header
3. Open landing page: https://stage.powiadomienia.info
4. Check browser DevTools Network tab:
   - Request URL: `/worker/stats`
   - Response headers: X-Cache-Status (HIT/MISS/STALE/FALLBACK)
   - Response time: ~50-100ms (cached) or ~500-1500ms (refresh)
5. Verify 4 stats cards display correctly

### 8.3 Cache Verification

**Check KV contents:**
```bash
# Get cached value (dev)
npx wrangler kv:key get "coverage-stats" --binding CACHE

# Get cached value (stage/prod)
npx wrangler kv:key get "coverage-stats" --binding CACHE --env stage

# Delete cache (force refresh on next request)
npx wrangler kv:key delete "coverage-stats" --binding CACHE --env stage
```

**Monitor logs:**
```bash
# Watch data-service logs
npx wrangler tail --env stage --format pretty

# Look for X-Cache-Status headers in responses
# Check for any error logs
```

---

## 9. Critical Files

**STATUS: ✅ ALL IMPLEMENTED**

**Database Queries:**
- `packages/data-ops/src/queries/address.ts` - 4 count queries ✅

**Zod Schema:**
- `packages/data-ops/src/zod-schema/stats.ts` - Coverage stats schema with expiresAt ✅

**Data Service:**
- `apps/data-service/src/index.ts` - DB init in WorkerEntrypoint constructor ✅
- `apps/data-service/src/lib/cache-stats.ts` - Cache helpers (TTL=7200s) ✅
- `apps/data-service/src/hono/app.ts` - GET /worker/stats + CORS + X-Cache-Status headers ✅
- `apps/data-service/wrangler.jsonc` - KV binding CACHE, fixed prod route ✅
- `apps/data-service/worker-configuration.d.ts` - Env types with CACHE + CORS vars ✅
- `apps/data-service/.dev.vars` - Local dev secrets ✅

**User Application:**
- `apps/user-application/src/routes/index.tsx` - 4 stats cards with i18n ✅
- `apps/user-application/.dev.vars` - VITE_DATA_SERVICE_URL=http://localhost:8788 ✅

---

## 10. Execution Order (COMPLETED)

**STATUS: ✅ ALL STEPS COMPLETED**

1. ✅ Added 4 count queries to `packages/data-ops/src/queries/address.ts`
2. ✅ Created Zod schema at `packages/data-ops/src/zod-schema/stats.ts` (with expiresAt)
3. ✅ Rebuilt data-ops: `pnpm run build:data-ops`
4. ✅ Created KV namespaces (binding: CACHE) for dev/stage/prod
5. ✅ Created cache utils at `apps/data-service/src/lib/cache-stats.ts` (TTL=7200s)
6. ✅ Moved DB init to WorkerEntrypoint constructor in `apps/data-service/src/index.ts`
7. ✅ Added CORS middleware + GET /worker/stats endpoint to `apps/data-service/src/hono/app.ts`
8. ✅ Added X-Cache-Status headers (HIT/MISS/STALE/FALLBACK)
9. ✅ Updated `apps/data-service/wrangler.jsonc` (KV bindings + fixed prod route)
10. ✅ Updated `apps/data-service/worker-configuration.d.ts` (CACHE + CORS env vars)
11. ✅ Created `apps/data-service/.dev.vars` with DB credentials + CORS env vars
12. ✅ Created `apps/user-application/.dev.vars` with VITE_DATA_SERVICE_URL
13. ✅ Updated landing page to fetch from API + display 4 stats cards
14. ✅ Added i18n translations for wasteSchedules and activeUsers
15. ✅ Deployed to stage/prod

---

## 11. Decisions

1. **On-demand refresh** over cron - simpler, self-healing, fewer moving parts ✅
2. **2h TTL** (not 24h) - faster refresh for more up-to-date stats, still cached enough ✅
3. **Prefer stale data** on DB errors - better UX than fallback to hardcoded ✅
4. **Cloudflare KV** over Durable Objects/R2 - perfect for infrequent writes, frequent reads ✅
5. **Public endpoint** - no auth required, stats are public info ✅
6. **CORS middleware** - env-aware origin checking (dev/stage/prod) ✅
7. **X-Cache-Status headers** - HIT/MISS/STALE/FALLBACK for debugging ✅
8. **4 stats tracked** - cities, streets, waste schedules, active users ✅
9. **Parallel count queries** - minimize DB query time (~200ms total vs ~800ms sequential) ✅
10. **Edge caching** - KV globally distributed, ~50-100ms response time ✅
11. **No manual TTL checking** - KV handles expiry automatically ✅
12. **DB init in constructor** - WorkerEntrypoint pattern, not per-request ✅
13. **KV binding name CACHE** - generic name for future reuse ✅
14. **expiresAt field** - client knows when cache expires for smarter refresh ✅
15. **i18n for all stats** - wasteSchedules and activeUsers translations added ✅

---

## 12. Performance

**Cache Hit (normal case):**
- Response time: ~50-100ms (KV edge cache)
- No database queries
- X-Cache-Status: HIT
- ~99% of requests after first cache population

**Cache Miss (first request or after 2h):**
- Response time: ~500-1500ms
- 4 parallel DB queries (~200-400ms)
- KV write (~50ms)
- Hono overhead (~50ms)
- Network latency (~200-800ms from user to Cloudflare)
- X-Cache-Status: MISS

**Error Recovery:**
- Try stale cache first (may work if deletion not propagated)
- X-Cache-Status: STALE if stale data returned
- Ultimate fallback: hardcoded values (instant)
- X-Cache-Status: FALLBACK

**Cost:**
- KV reads: $0.50 per 10M requests (negligible)
- KV writes: $5.00 per 1M writes (12 per day = ~$0.02/month)
- Worker CPU: Included in Workers plan
- Database queries: Neon free tier (12 per day)

---

## 13. Why On-Demand > Cron

**On-Demand Advantages:**
- ✅ Simpler: No cron setup, no scheduled handler
- ✅ Self-healing: Cache refreshes automatically when needed
- ✅ Cost-effective: No scheduled worker invocations
- ✅ Less infrastructure: One less moving part to maintain
- ✅ Still fast: Only first request after 2h is slow (~1s)

**Cron Advantages:**
- ✅ All requests always fast (no slow refresh request)
- ✅ Proactive error detection (logs if DB query fails)
- ✅ Can schedule refresh during low-traffic hours

**Decision:** On-demand is better for this use case because:
- Stats don't need real-time accuracy
- Landing page has high traffic (cache rarely expires under load)
- Simpler architecture is easier to maintain
- One slow request per 2h is acceptable tradeoff
- X-Cache-Status headers make cache behavior transparent

---

## 14. Alternatives Considered

### Cloudflare Durable Objects
- ❌ Overkill for simple stats caching
- ❌ Higher cost, more complexity
- ❌ Provides strong consistency (not needed)

### Cloudflare R2
- ❌ Object storage, not key-value
- ❌ Higher latency than KV
- ❌ No TTL/expiration built-in

### Cloudflare Cache API
- ❌ Designed for HTTP responses, not data
- ❌ Less control over invalidation
- ❌ Would need custom Cache-Control headers

### In-memory cache in worker
- ❌ Lost on cold starts (frequent in Workers)
- ❌ Not shared across edge locations
- ❌ No persistence

### Direct DB query (no cache)
- ❌ ~500-1500ms latency every request
- ❌ Unnecessary load on Neon Postgres
- ❌ Poor UX for landing page visitors

---

## 15. Future Enhancements

1. **Admin endpoint** - Force cache refresh on-demand (POST /worker/stats/refresh)
2. **Cache metrics** - Track hit/miss ratio, refresh count via X-Cache-Status
3. **More stats** - Notification logs count, popular cities, notification delivery rate
4. **Regional caching** - Different stats per region/language
5. **Webhook refresh** - Trigger cache update after DB seed/migration
6. **Stale-while-revalidate** - Return stale data, refresh in background (already partially implemented)
7. **Historical tracking** - Store stats snapshots for growth charts
8. **TTL configuration** - Make TTL configurable per environment (dev shorter, prod longer)

---

## 16. Implementation Summary (2025-12-18)

### ✅ FULLY IMPLEMENTED

**Key Implementation Details:**
1. **TTL: 2 hours (7200s)** - Not 24h as originally designed
2. **KV binding: CACHE** - Generic name for future reuse
3. **Schema includes expiresAt** - Client knows when cache expires
4. **DB init in WorkerEntrypoint constructor** - Not per-request
5. **CORS middleware added** - Env-aware origin checking
6. **X-Cache-Status headers** - HIT/MISS/STALE/FALLBACK for debugging
7. **4 stats cards on landing page** - Cities, streets, wasteSchedules, activeUsers
8. **i18n translations added** - All stats have translations
9. **Prod route fixed** - `powiadomienia.info/worker/*` (was broken)
10. **Local dev port 8788** - data-service runs on 8788, not 3000
11. **Use .dev.vars** - Not .env files for local development
12. **CORS env vars added** - CLOUDFLARE_ENV_STAGE_ADDRESS, CLOUDFLARE_ENV_PROD_ADDRESS

### Testing Verification:
- Cache hit/miss working correctly with X-Cache-Status headers
- CORS allows requests from user-application origins
- Stale cache fallback tested
- Hardcoded fallback tested (citiesCount: 5, streetsCount: 1987)
- All 4 stats cards display correctly on landing page

### Production Status:
- Deployed to stage: ✅
- Deployed to prod: ✅
- KV namespaces created for all envs: ✅
- Secrets configured: ✅
