import type { MiddlewareHandler } from "hono";

interface RateLimitRecord {
	count: number;
	resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export function resetRateLimitStore() {
	rateLimitStore.clear();
}

export function rateLimit(maxRequests: number, windowMs: number): MiddlewareHandler {
	return async (c, next) => {
		const ip = c.req.header("cf-connecting-ip") || "unknown";
		const now = Date.now();

		const record = rateLimitStore.get(ip);

		if (record && now < record.resetAt) {
			if (record.count >= maxRequests) {
				return c.json({ error: "Too many requests", status: 429 }, 429);
			}
			record.count++;
		} else {
			rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
		}

		await next();
	};
}
