import { describe, it, expect } from "vitest";
import type { NotificationChannel, NotificationPayload } from "@repo/data-ops/channels/port";
import { ChannelError } from "@repo/data-ops/channels/port";
import { TelegramChannel } from "./telegram";
import { SerwerSMSChannel } from "./serwer-sms";
import { NoopChannel } from "@repo/test-harness/noop-channel";

const payload: NotificationPayload = {
	recipient: "+48123456789",
	subject: "Test notification",
	body: "Test body",
	sourceId: 1,
	channelId: 1,
};

/**
 * Contract test factory: every NotificationChannel adapter must pass these tests.
 * Adapters that cannot send (stub/disabled) must throw ChannelError with a known type.
 */
function channelContractSuite(
	name: string,
	createChannel: () => NotificationChannel,
	expectation: "delivers" | "throws",
	expectedErrorType?: string,
) {
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

		if (expectation === "delivers") {
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
		}

		if (expectation === "throws") {
			it(`throws ChannelError with type '${expectedErrorType}' on send`, async () => {
				const channel = createChannel();
				try {
					await channel.send(payload);
					expect.unreachable("should have thrown");
				} catch (err) {
					expect(err).toBeInstanceOf(ChannelError);
					expect((err as ChannelError).type).toBe(expectedErrorType);
				}
			});
		}
	});
}

// --- Adapter registrations ---

channelContractSuite("TelegramChannel", () => new TelegramChannel(), "throws", "not_implemented");

channelContractSuite(
	"SerwerSMSChannel (disabled)",
	() => new SerwerSMSChannel({ apiToken: "tok", senderName: "T", featureEnabled: false }),
	"throws",
	"feature_disabled",
);

channelContractSuite(
	"NoopChannel",
	() => new NoopChannel() as unknown as NotificationChannel,
	"delivers",
);
