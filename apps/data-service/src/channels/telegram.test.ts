import { describe, it, expect } from "vitest";
import { TelegramChannel } from "./telegram";
import { ChannelError, type NotificationPayload } from "@repo/data-ops/channels/port";

const payload: NotificationPayload = {
	recipient: "123456789",
	subject: "Test",
	body: "Hello",
	sourceId: 1,
	channelId: 1,
};

describe("TelegramChannel", () => {
	it("implements NotificationChannel with name 'telegram'", () => {
		const channel = new TelegramChannel();
		expect(channel.name).toBe("telegram");
	});

	it("throws ChannelError with type 'not_implemented' on send", async () => {
		const channel = new TelegramChannel();
		await expect(channel.send(payload)).rejects.toThrow(ChannelError);
		await expect(channel.send(payload)).rejects.toMatchObject({
			type: "not_implemented",
		});
	});
});
