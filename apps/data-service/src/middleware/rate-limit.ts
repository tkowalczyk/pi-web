import type { Context, Next } from "hono";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    const ip = c.req.header("cf-connecting-ip") || "unknown";
    const now = Date.now();

    const record = rateLimitStore.get(ip);

    if (record && now < record.resetAt) {
      if (record.count >= maxRequests) {
        return c.json({ error: "Too many requests" }, 429);
      }
      record.count++;
    } else {
      rateLimitStore.set(ip, {
        count: 1,
        resetAt: now + windowMs,
      });
    }

    await next();
  };
}
