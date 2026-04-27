import { describe, it, expect } from "vitest";
import type { NotificationChannel, NotificationPayload } from "@repo/data-ops/channels/port";
import { TelegramChannel } from "./telegram";
import { NoopChannel } from "@repo/test-harness/noop-channel";

const payload: NotificationPayload = {
	recipient: "+48123456789",
	subject: "Test notification",
	body: "Test body",
	sourceId: 1,
	channelId: 1,
};

function channelContractSuite(name: string, createChannel: () => NotificationChannel) {
	describe(`${name} — contract`, () => {
		it("has a non-empty string name", () => {
			const channel = createChannel();
			expect(typeof channel.name).toBe("string");
			expect(channel.name.length).toBeGreaterThan(0);
		});

		it("has a send method", () => {
			const channel = createChannel();
			expect(typeof channel.send).toBe("function");
		});

		it("returns a DeliveryResult with success=true and timestamp", async () => {
			const channel = createChannel();
			const result = await channel.send(payload);
			expect(result.success).toBe(true);
			expect(result.timestamp).toBeInstanceOf(Date);
		});

		it("is idempotent — calling send twice produces two independent results", async () => {
			const channel = createChannel();
			const r1 = await channel.send(payload);
			const r2 = await channel.send(payload);
			expect(r1.success).toBe(true);
			expect(r2.success).toBe(true);
			expect(r1.timestamp.getTime()).toBeLessThanOrEqual(r2.timestamp.getTime());
		});
	});
}

channelContractSuite("TelegramChannel", () => {
	const fetchFn = async () =>
		new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	return new TelegramChannel({ botToken: "test-token", fetchFn });
});

channelContractSuite("NoopChannel", () => new NoopChannel() as unknown as NotificationChannel);
