import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { rateLimit, resetRateLimitStore } from "./rate-limit";

function createTestApp(maxRequests: number, windowMs: number) {
	const app = new Hono();
	app.use("*", rateLimit(maxRequests, windowMs));
	app.get("/test", (c) => c.json({ ok: true }));
	return app;
}

describe("rate-limit middleware", () => {
	beforeEach(() => {
		resetRateLimitStore();
	});

	it("allows requests under the limit", async () => {
		const app = createTestApp(3, 60_000);

		const res1 = await app.request("/test");
		const res2 = await app.request("/test");
		const res3 = await app.request("/test");

		expect(res1.status).toBe(200);
		expect(res2.status).toBe(200);
		expect(res3.status).toBe(200);
	});

	it("rejects requests over the limit with 429", async () => {
		const app = createTestApp(2, 60_000);

		await app.request("/test");
		await app.request("/test");
		const res = await app.request("/test");

		expect(res.status).toBe(429);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Too many requests");
	});

	it("returns structured error response on 429", async () => {
		const app = createTestApp(1, 60_000);

		await app.request("/test");
		const res = await app.request("/test");

		expect(res.status).toBe(429);
		const body = await res.json();
		expect(body).toMatchObject({
			error: "Too many requests",
			status: 429,
		});
	});
});
