import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { requestId } from "./request-id";
import { errorHandler, HttpError } from "./error-handler";

function createTestApp() {
	const app = new Hono();
	app.use("*", requestId());
	app.onError(errorHandler);
	return app;
}

describe("error-handler middleware", () => {
	it("catches unhandled errors and returns structured JSON with 500 status", async () => {
		const app = createTestApp();
		app.get("/boom", () => {
			throw new Error("something broke");
		});

		const res = await app.request("/boom");

		expect(res.status).toBe(500);
		const body = (await res.json()) as { error: string; status: number; requestId: string };
		expect(body).toMatchObject({
			error: "Internal Server Error",
			status: 500,
		});
		expect(body.requestId).toBeTruthy();
	});

	it("renders HttpError with the correct status code and message", async () => {
		const app = createTestApp();
		app.get("/not-found", () => {
			throw new HttpError(404, "Resource not found");
		});

		const res = await app.request("/not-found");

		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: string; status: number; requestId: string };
		expect(body).toMatchObject({
			error: "Resource not found",
			status: 404,
		});
		expect(body.requestId).toBeTruthy();
	});

	it("includes the request ID from the middleware in the error response", async () => {
		const app = createTestApp();
		app.get("/fail", () => {
			throw new Error("fail");
		});

		const res = await app.request("/fail", {
			headers: { "X-Request-Id": "trace-abc" },
		});

		const body = (await res.json()) as { error: string; status: number; requestId: string };
		expect(body.requestId).toBe("trace-abc");
	});

	it("does not leak error details in production-like responses", async () => {
		const app = createTestApp();
		app.get("/secret", () => {
			throw new Error("database password is hunter2");
		});

		const res = await app.request("/secret");
		const body = (await res.json()) as { error: string; status: number; requestId: string };

		expect(body.error).toBe("Internal Server Error");
		expect(JSON.stringify(body)).not.toContain("hunter2");
	});
});
