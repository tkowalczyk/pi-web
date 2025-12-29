import {
  getCitiesCount,
  getStreetsCount,
  getWasteSchedulesCount,
  getActiveUsersCount,
} from "@repo/data-ops/queries/address";
import type { CoverageStatsResponse } from "@repo/data-ops/zod-schema/stats";

const CACHE_KEY = "coverage-stats";
const TTL_SECONDS = 7200;

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
    expiresAt: expiresAt.toISOString(),
  };

  await kv.put(CACHE_KEY, JSON.stringify(stats), { expirationTtl: TTL_SECONDS });

  return stats;
}

export async function getCoverageStats(kv: KVNamespace): Promise<CoverageStatsResponse | null> {
  const cached = await kv.get(CACHE_KEY, "json");
  return cached as CoverageStatsResponse | null;
}
