import { describe, it, expect, vi } from "vitest";
import { getOrCreateSystemTopicId, type SystemTopicDeps } from "./system-topic";

function makeDeps(overrides: Partial<SystemTopicDeps> = {}): SystemTopicDeps {
	return {
		getCachedTopicId: vi.fn().mockResolvedValue(null),
		setCachedTopicId: vi.fn().mockResolvedValue(undefined),
		createForumTopic: vi.fn().mockResolvedValue(42),
		chatId: "chat-123",
		...overrides,
	};
}

describe("getOrCreateSystemTopicId", () => {
	it("returns cached topic ID when available", async () => {
		const deps = makeDeps({
			getCachedTopicId: vi.fn().mockResolvedValue(999),
		});

		const id = await getOrCreateSystemTopicId(deps);

		expect(id).toBe(999);
		expect(deps.createForumTopic).not.toHaveBeenCalled();
	});

	it("creates topic and caches it when not cached", async () => {
		const deps = makeDeps({
			getCachedTopicId: vi.fn().mockResolvedValue(null),
			createForumTopic: vi.fn().mockResolvedValue(42),
		});

		const id = await getOrCreateSystemTopicId(deps);

		expect(id).toBe(42);
		expect(deps.createForumTopic).toHaveBeenCalledWith("chat-123", "⚠️ System");
		expect(deps.setCachedTopicId).toHaveBeenCalledWith(42);
	});
});
