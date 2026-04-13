import { describe, it, expect } from "vitest";
import { buildSelfAlertPayload } from "./self-alert";

describe("buildSelfAlertPayload", () => {
	it("returns a payload when failure count exceeds threshold", () => {
		const payload = buildSelfAlertPayload({
			failureCount: 6,
			threshold: 5,
			sourceNames: ["Wywóz śmieci", "Urodziny"],
			recipient: "chat-123",
			channelId: 1,
			messageThreadId: 999,
		});

		expect(payload).not.toBeNull();
		expect(payload!.body).toContain("6");
		expect(payload!.body).toContain("Wywóz śmieci");
		expect(payload!.body).toContain("Urodziny");
		expect(payload!.recipient).toBe("chat-123");
		expect(payload!.metadata).toEqual({ message_thread_id: 999 });
	});

	it("returns null when failure count is at threshold", () => {
		const payload = buildSelfAlertPayload({
			failureCount: 5,
			threshold: 5,
			sourceNames: ["Wywóz śmieci"],
			recipient: "chat-123",
			channelId: 1,
			messageThreadId: 999,
		});

		expect(payload).toBeNull();
	});

	it("returns null when failure count is below threshold", () => {
		const payload = buildSelfAlertPayload({
			failureCount: 2,
			threshold: 5,
			sourceNames: [],
			recipient: "chat-123",
			channelId: 1,
			messageThreadId: 999,
		});

		expect(payload).toBeNull();
	});

	it("includes ⚠️ emoji in the alert body", () => {
		const payload = buildSelfAlertPayload({
			failureCount: 10,
			threshold: 3,
			sourceNames: ["Test"],
			recipient: "chat-123",
			channelId: 1,
			messageThreadId: 999,
		});

		expect(payload!.body).toContain("⚠️");
	});

	it("uses sourceId 0 for system alerts", () => {
		const payload = buildSelfAlertPayload({
			failureCount: 10,
			threshold: 3,
			sourceNames: ["Test"],
			recipient: "chat-123",
			channelId: 1,
			messageThreadId: 999,
		});

		expect(payload!.sourceId).toBe(0);
		expect(payload!.subject).toContain("System");
	});
});
