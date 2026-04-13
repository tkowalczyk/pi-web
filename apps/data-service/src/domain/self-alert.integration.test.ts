import { describe, it, expect, vi } from "vitest";
import { handleSelfAlert, type SelfAlertDeps } from "./self-alert";
import { NoopChannel } from "@repo/test-harness/noop-channel";

function makeDeps(overrides: Partial<SelfAlertDeps> = {}): SelfAlertDeps {
	return {
		getRecentFailureCount: vi.fn().mockResolvedValue(0),
		getRecentFailureSources: vi.fn().mockResolvedValue([]),
		channel: new NoopChannel(),
		threshold: 5,
		recipient: "chat-123",
		channelId: 1,
		getOrCreateSystemTopicId: vi.fn().mockResolvedValue(999),
		...overrides,
	};
}

describe("handleSelfAlert", () => {
	it("sends alert when failure count exceeds threshold", async () => {
		const channel = new NoopChannel();
		const deps = makeDeps({
			getRecentFailureCount: vi.fn().mockResolvedValue(6),
			getRecentFailureSources: vi.fn().mockResolvedValue(["Wywóz śmieci", "Urodziny"]),
			channel,
			threshold: 5,
		});

		await handleSelfAlert(deps);

		expect(channel.invocations).toHaveLength(1);
		const sent = channel.invocations[0]!.payload;
		expect(sent.body).toContain("6");
		expect(sent.body).toContain("Wywóz śmieci");
		expect(sent.body).toContain("Urodziny");
		expect(sent.metadata).toEqual({ message_thread_id: 999 });
	});

	it("does not send alert when failure count is below threshold", async () => {
		const channel = new NoopChannel();
		const deps = makeDeps({
			getRecentFailureCount: vi.fn().mockResolvedValue(4),
			getRecentFailureSources: vi.fn().mockResolvedValue(["Test"]),
			channel,
			threshold: 5,
		});

		await handleSelfAlert(deps);

		expect(channel.invocations).toHaveLength(0);
	});

	it("does not send alert when failure count equals threshold", async () => {
		const channel = new NoopChannel();
		const deps = makeDeps({
			getRecentFailureCount: vi.fn().mockResolvedValue(5),
			getRecentFailureSources: vi.fn().mockResolvedValue(["Test"]),
			channel,
			threshold: 5,
		});

		await handleSelfAlert(deps);

		expect(channel.invocations).toHaveLength(0);
	});

	it("calls getOrCreateSystemTopicId before sending", async () => {
		const getOrCreateSystemTopicId = vi.fn().mockResolvedValue(777);
		const channel = new NoopChannel();
		const deps = makeDeps({
			getRecentFailureCount: vi.fn().mockResolvedValue(10),
			getRecentFailureSources: vi.fn().mockResolvedValue(["Src"]),
			channel,
			getOrCreateSystemTopicId,
		});

		await handleSelfAlert(deps);

		expect(getOrCreateSystemTopicId).toHaveBeenCalledOnce();
		expect(channel.invocations[0]!.payload.metadata).toEqual({ message_thread_id: 777 });
	});
});
