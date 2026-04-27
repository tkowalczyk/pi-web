import { describe, it, expect, vi } from "vitest";
import { createSourceWithTopic, type SourceLifecycleDeps } from "./source-lifecycle";
import { TELEGRAM_TOPIC_EMOJI } from "./source-topic";

function makeDeps(overrides: Partial<SourceLifecycleDeps> = {}): SourceLifecycleDeps {
	return {
		insertSource: vi.fn().mockResolvedValue({
			id: 1,
			householdId: 10,
			name: "Wywóz — Kwiatowa",
			type: "waste_collection",
			config: {},
			topicId: null,
			enabled: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		}),
		createForumTopic: vi.fn().mockResolvedValue(777),
		updateSource: vi.fn().mockResolvedValue({
			id: 1,
			topicId: 777,
		}),
		...overrides,
	};
}

describe("createSourceWithTopic", () => {
	it("inserts source, creates forum topic, and updates source with topicId", async () => {
		const deps = makeDeps();

		const result = await createSourceWithTopic(
			{
				householdId: 10,
				name: "Wywóz — Kwiatowa",
				type: "waste_collection",
				config: {},
			},
			"-1001234567890",
			deps,
		);

		expect(deps.insertSource).toHaveBeenCalledOnce();
		expect(deps.createForumTopic).toHaveBeenCalledWith(
			"-1001234567890",
			"Wywóz — Kwiatowa",
			TELEGRAM_TOPIC_EMOJI.waste_collection,
		);
		expect(deps.updateSource).toHaveBeenCalledWith(1, { topicId: 777 });
		expect(result.topicId).toBe(777);
	});

	it("uses source name and type emoji for topic creation", async () => {
		const deps = makeDeps({
			insertSource: vi.fn().mockResolvedValue({
				id: 2,
				householdId: 10,
				name: "Urodziny rodziny",
				type: "birthday",
				config: {},
				topicId: null,
				enabled: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			}),
		});

		await createSourceWithTopic(
			{
				householdId: 10,
				name: "Urodziny rodziny",
				type: "birthday",
				config: {},
			},
			"-1001234567890",
			deps,
		);

		expect(deps.createForumTopic).toHaveBeenCalledWith(
			"-1001234567890",
			"Urodziny rodziny",
			TELEGRAM_TOPIC_EMOJI.birthday,
		);
	});

	it("still creates source even if type has no emoji", async () => {
		const deps = makeDeps({
			insertSource: vi.fn().mockResolvedValue({
				id: 3,
				householdId: 10,
				name: "Custom alerts",
				type: "generic",
				config: {},
				topicId: null,
				enabled: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			}),
		});

		await createSourceWithTopic(
			{
				householdId: 10,
				name: "Custom alerts",
				type: "generic",
				config: {},
			},
			"-1001234567890",
			deps,
		);

		expect(deps.createForumTopic).toHaveBeenCalledWith(
			"-1001234567890",
			"Custom alerts",
			undefined,
		);
	});
});
