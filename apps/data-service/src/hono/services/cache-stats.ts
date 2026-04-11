// Legacy coverage stats (cities/streets/wasteSchedules) removed in M2-P2.
// TODO: Replace with household-based stats when ready.

export interface StatsResponse {
	activeUsersCount: number;
	lastUpdated: string;
	expiresAt: string;
}

const CACHE_KEY = "coverage-stats";
const TTL_SECONDS = 7200;

export async function refreshCoverageStats(kv: KVNamespace): Promise<StatsResponse> {
	const now = new Date();
	const expiresAt = new Date(now.getTime() + TTL_SECONDS * 1000);

	const stats: StatsResponse = {
		activeUsersCount: 0,
		lastUpdated: now.toISOString(),
		expiresAt: expiresAt.toISOString(),
	};

	await kv.put(CACHE_KEY, JSON.stringify(stats), { expirationTtl: TTL_SECONDS });

	return stats;
}

export async function getCoverageStats(kv: KVNamespace): Promise<StatsResponse | null> {
	const cached = await kv.get(CACHE_KEY, "json");
	return cached as StatsResponse | null;
}
