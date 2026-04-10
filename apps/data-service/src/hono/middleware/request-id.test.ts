import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { requestId } from "./request-id";

function createTestApp() {
	const app = new Hono();
	app.use("*", requestId());
	app.get("/test", (c) => c.json({ requestId: c.get("requestId") }));
	return app;
}

describe("request-id middleware", () => {
	it("generates a unique request ID and sets it on the response header", async () => {
		const app = createTestApp();
		const res = await app.request("/test");

		expect(res.status).toBe(200);
		const header = res.headers.get("X-Request-Id");
		expect(header).toBeTruthy();
		expect(typeof header).toBe("string");
		expect(header!.length).toBeGreaterThan(0);

		const body = await res.json();
		expect(body.requestId).toBe(header);
	});

	it("preserves an existing X-Request-Id from the incoming request", async () => {
		const app = createTestApp();
		const res = await app.request("/test", {
			headers: { "X-Request-Id": "existing-id-123" },
		});

		expect(res.headers.get("X-Request-Id")).toBe("existing-id-123");
		const body = await res.json();
		expect(body.requestId).toBe("existing-id-123");
	});

	it("generates different IDs for different requests", async () => {
		const app = createTestApp();
		const res1 = await app.request("/test");
		const res2 = await app.request("/test");

		const id1 = res1.headers.get("X-Request-Id");
		const id2 = res2.headers.get("X-Request-Id");
		expect(id1).not.toBe(id2);
	});
});
