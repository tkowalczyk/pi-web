import type { Handler } from "hono";
import { getCoverageStats, refreshCoverageStats } from "../services/cache-stats";
import type { CoverageStatsResponse } from "@repo/data-ops/zod-schema/stats";
import { createLogger } from "../utils/logger";

export const statsHandler: Handler = async (c) => {
	const logger = createLogger(c.get("requestId"));

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
		logger.error("stats fetch failed", { error: String(error) });

		try {
			const staleStats = await c.env.CACHE.get("coverage-stats", "json");
			if (staleStats) {
				c.header("X-Cache-Status", "STALE");
				return c.json(staleStats as CoverageStatsResponse);
			}
		} catch (staleError) {
			logger.error("stale cache also unavailable", { error: String(staleError) });
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
};
