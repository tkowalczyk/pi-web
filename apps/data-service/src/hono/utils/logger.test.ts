import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLogger } from "./logger";

describe("structured logger", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("logs info with requestId, level, and message", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		const logger = createLogger("req-123");

		logger.info("request started");

		expect(spy).toHaveBeenCalledOnce();
		const output = JSON.parse(spy.mock.calls[0]?.[0] as string);
		expect(output).toMatchObject({
			level: "info",
			requestId: "req-123",
			message: "request started",
		});
	});

	it("logs error with requestId, level, and message", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const logger = createLogger("req-456");

		logger.error("something failed");

		expect(spy).toHaveBeenCalledOnce();
		const output = JSON.parse(spy.mock.calls[0]?.[0] as string);
		expect(output).toMatchObject({
			level: "error",
			requestId: "req-456",
			message: "something failed",
		});
	});

	it("logs warn with requestId, level, and message", () => {
		const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const logger = createLogger("req-789");

		logger.warn("slow response");

		expect(spy).toHaveBeenCalledOnce();
		const output = JSON.parse(spy.mock.calls[0]?.[0] as string);
		expect(output).toMatchObject({
			level: "warn",
			requestId: "req-789",
			message: "slow response",
		});
	});

	it("includes extra context in the log output", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		const logger = createLogger("req-ctx");

		logger.info("db query", { table: "users", duration: 42 });

		const output = JSON.parse(spy.mock.calls[0]?.[0] as string);
		expect(output.table).toBe("users");
		expect(output.duration).toBe(42);
	});

	it("includes a timestamp in ISO format", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		const logger = createLogger("req-ts");

		logger.info("test");

		const output = JSON.parse(spy.mock.calls[0]?.[0] as string);
		expect(output.timestamp).toBeTruthy();
		expect(() => new Date(output.timestamp)).not.toThrow();
	});
});
