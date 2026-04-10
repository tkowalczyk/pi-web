import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { requestId } from "../middleware/request-id";
import { healthHandler } from "./health";

function createTestApp() {
	const app = new Hono();
	app.use("*", requestId());
	app.get("/worker/health", healthHandler);
	return app;
}

describe("health handler", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("returns service info as JSON", async () => {
		const app = createTestApp();
		const res = await app.request("/worker/health");

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.name).toBe("powiadomienia.info Worker");
		expect(body.version).toBeTruthy();
	});

	it("emits a structured log entry with the request ID", async () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		const app = createTestApp();

		await app.request("/worker/health", {
			headers: { "X-Request-Id": "health-trace-1" },
		});

		const logCalls = spy.mock.calls
			.map((call) => {
				try {
					return JSON.parse(call[0] as string);
				} catch {
					return null;
				}
			})
			.filter(Boolean);

		const healthLog = logCalls.find(
			(entry: Record<string, unknown>) =>
				entry.requestId === "health-trace-1" && entry.level === "info",
		);
		expect(healthLog).toBeTruthy();
	});
});
