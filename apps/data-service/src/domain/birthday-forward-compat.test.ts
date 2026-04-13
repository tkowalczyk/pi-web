import { describe, it, expect } from "vitest";
import { renderMessage } from "./birthday-handler";
import { NoopChannel } from "@repo/test-harness/noop-channel";

describe("M3 forward-compatibility: birthday handler → direct channel send (no DO)", () => {
	it("handler renders message and sends directly through channel without SchedulerDO", async () => {
		const config = {
			birthdays: [
				{ name: "Mama", date: "03-15" },
				{ name: "Tata", date: "11-02" },
			],
		};

		const body = renderMessage(config, "Mama");

		const channel = new NoopChannel();
		const result = await channel.send({
			recipient: "chat-123",
			subject: "Urodziny rodziny",
			body,
			sourceId: 77,
			channelId: 5,
		});

		expect(result.success).toBe(true);
		expect(channel.invocations).toHaveLength(1);
		expect(channel.invocations[0]?.payload.body).toContain("🎂");
		expect(channel.invocations[0]?.payload.body).toContain("Mama");
	});
});
