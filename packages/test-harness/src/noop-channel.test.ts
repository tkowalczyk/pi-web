import { describe, it, expect, beforeEach } from "vitest";
import { NoopChannel, type NoopNotificationPayload } from "./noop-channel";

const payload: NoopNotificationPayload = {
	recipient: "test@example.com",
	subject: "Test",
	body: "Hello",
	sourceId: 1,
	channelId: 2,
};

describe("NoopChannel", () => {
	let channel: NoopChannel;

	beforeEach(() => {
		channel = new NoopChannel();
	});

	it("implements NotificationChannel with name 'noop'", () => {
		expect(channel.name).toBe("noop");
	});

	it("records invocations on send", async () => {
		const result = await channel.send(payload);
		expect(result.success).toBe(true);
		expect(result.messageId).toBeDefined();
		expect(channel.invocations).toHaveLength(1);
		expect(channel.invocations[0]!.payload).toEqual(payload);
		expect(channel.invocations[0]?.result).toEqual(result);
	});

	it("accumulates multiple invocations", async () => {
		await channel.send(payload);
		await channel.send({ ...payload, recipient: "other" });
		expect(channel.invocations).toHaveLength(2);
	});

	it("resets invocations", async () => {
		await channel.send(payload);
		expect(channel.invocations).toHaveLength(1);
		channel.reset();
		expect(channel.invocations).toHaveLength(0);
	});
});
