import { describe, it, expect, vi } from "vitest";
import { SerwerSMSChannel } from "./serwer-sms";
import { ChannelError, type NotificationPayload } from "@repo/data-ops/channels/port";

const payload: NotificationPayload = {
	recipient: "+48123456789",
	subject: "Waste collection",
	body: "Jutro wywóz śmieci: Papier, Plastik",
	sourceId: 1,
	channelId: 3,
};

describe("SerwerSMSChannel", () => {
	it("implements NotificationChannel with name 'serwer-sms'", () => {
		const channel = new SerwerSMSChannel({
			apiToken: "tok",
			senderName: "Test",
			featureEnabled: false,
		});
		expect(channel.name).toBe("serwer-sms");
	});

	it("throws ChannelError 'feature_disabled' when FEATURE_SMS_ENABLED is false", async () => {
		const channel = new SerwerSMSChannel({
			apiToken: "tok",
			senderName: "Test",
			featureEnabled: false,
		});
		await expect(channel.send(payload)).rejects.toThrow(ChannelError);
		await expect(channel.send(payload)).rejects.toMatchObject({
			type: "feature_disabled",
		});
	});

	it("delegates to sendSms when feature is enabled", async () => {
		const mockSendSms = vi.fn().mockResolvedValue({
			messageId: "sms-123",
			parts: 1,
			status: "queued",
		});

		const channel = new SerwerSMSChannel({
			apiToken: "my-token",
			senderName: "WywozSmieci",
			featureEnabled: true,
			sendSmsFn: mockSendSms,
		});

		const result = await channel.send(payload);

		expect(mockSendSms).toHaveBeenCalledWith(
			"my-token",
			"+48123456789",
			"Jutro wywóz śmieci: Papier, Plastik",
			"WywozSmieci",
		);
		expect(result.success).toBe(true);
		expect(result.messageId).toBe("sms-123");
	});

	it("returns failure result when sendSms returns error", async () => {
		const mockSendSms = vi.fn().mockResolvedValue({ error: "API down" });

		const channel = new SerwerSMSChannel({
			apiToken: "tok",
			senderName: "Test",
			featureEnabled: true,
			sendSmsFn: mockSendSms,
		});

		const result = await channel.send(payload);

		expect(result.success).toBe(false);
		expect(result.error).toBe("API down");
	});
});
