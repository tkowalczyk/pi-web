import { describe, it, expect, vi } from "vitest";
import { handleLeadNotify, type LeadNotifyDeps } from "./lead-notify";
import { NoopChannel } from "@repo/test-harness/noop-channel";

function makeDeps(overrides: Partial<LeadNotifyDeps> = {}): LeadNotifyDeps {
	return {
		channel: new NoopChannel() as unknown as LeadNotifyDeps["channel"],
		getOrCreateTopicId: vi.fn().mockResolvedValue(555),
		chatId: "chat-abc",
		...overrides,
	};
}

describe("handleLeadNotify", () => {
	it("sends a payload to channel with rendered body, recipient=chatId, and message_thread_id metadata", async () => {
		const channel = new NoopChannel();
		const deps = makeDeps({
			channel: channel as unknown as LeadNotifyDeps["channel"],
			getOrCreateTopicId: vi.fn().mockResolvedValue(555),
			chatId: "chat-abc",
		});

		await handleLeadNotify(
			{ email: "lead@example.com", createdAt: new Date("2026-05-04T10:30:00Z") },
			deps,
		);

		expect(channel.invocations).toHaveLength(1);
		const sent = channel.invocations[0]!.payload;
		expect(sent.recipient).toBe("chat-abc");
		expect(sent.body).toContain("<code>lead@example.com</code>");
		expect(sent.body).toContain("📩");
		expect(sent.metadata).toEqual({ message_thread_id: 555 });
	});
});
