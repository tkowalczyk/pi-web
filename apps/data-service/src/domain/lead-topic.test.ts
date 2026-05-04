import { describe, it, expect, vi } from "vitest";
import { getOrCreateLeadTopicId, type LeadTopicDeps } from "./lead-topic";

function makeDeps(overrides: Partial<LeadTopicDeps> = {}): LeadTopicDeps {
	return {
		getCachedTopicId: vi.fn().mockResolvedValue(null),
		setCachedTopicId: vi.fn().mockResolvedValue(undefined),
		createForumTopic: vi.fn().mockResolvedValue(123),
		chatId: "chat-456",
		...overrides,
	};
}

describe("getOrCreateLeadTopicId", () => {
	it("returns cached topic ID when available", async () => {
		const deps = makeDeps({
			getCachedTopicId: vi.fn().mockResolvedValue(777),
		});

		const id = await getOrCreateLeadTopicId(deps);

		expect(id).toBe(777);
		expect(deps.createForumTopic).not.toHaveBeenCalled();
	});

	it("creates the '📩 Leads' topic and caches it when not cached", async () => {
		const deps = makeDeps({
			getCachedTopicId: vi.fn().mockResolvedValue(null),
			createForumTopic: vi.fn().mockResolvedValue(123),
		});

		const id = await getOrCreateLeadTopicId(deps);

		expect(id).toBe(123);
		expect(deps.createForumTopic).toHaveBeenCalledWith("chat-456", "📩 Leads");
		expect(deps.setCachedTopicId).toHaveBeenCalledWith(123);
	});
});
