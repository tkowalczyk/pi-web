import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCoverageStats, refreshCoverageStats } from "@/lib/cache-stats";
import type { CoverageStatsResponse } from "@repo/data-ops/zod-schema/stats";

export const app = new Hono<{ Bindings: Env }>();

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

    try {
      const staleStats = await c.env.CACHE.get("coverage-stats", "json");
      if (staleStats) {
        c.header("X-Cache-Status", "STALE");
        return c.json(staleStats as CoverageStatsResponse);
      }
    } catch (staleError) {
      console.error("[stats] Stale cache also unavailable:", staleError);
    }

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
