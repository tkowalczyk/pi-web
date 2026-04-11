import { describe, it, expect } from "vitest";
import { getTopicMetadata } from "./source-topic";

describe("getTopicMetadata", () => {
	it("returns name and emoji for waste_collection type", () => {
		const meta = getTopicMetadata("waste_collection", "Wywóz — Kwiatowa");

		expect(meta.name).toBe("Wywóz — Kwiatowa");
		expect(meta.iconCustomEmojiId).toBe("🗑");
	});

	it("returns name and emoji for birthday type", () => {
		const meta = getTopicMetadata("birthday", "Urodziny rodziny");

		expect(meta.name).toBe("Urodziny rodziny");
		expect(meta.iconCustomEmojiId).toBe("🎂");
	});

	it("returns name without emoji for unknown type", () => {
		const meta = getTopicMetadata("unknown_type", "Some source");

		expect(meta.name).toBe("Some source");
		expect(meta.iconCustomEmojiId).toBeUndefined();
	});
});
