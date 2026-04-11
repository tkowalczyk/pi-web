import { describe, it, expect } from "vitest";
import { WasteCollectionConfig } from "./waste-collection-config";

describe("WasteCollectionConfig zod schema", () => {
	it("accepts a valid waste collection config", () => {
		const input = {
			address: "ul. Kwiatowa 5",
			schedule: [
				{ type: "szkło", dates: ["2026-04-15", "2026-04-29"] },
				{ type: "papier", dates: ["2026-04-20"] },
			],
		};

		const result = WasteCollectionConfig.safeParse(input);
		expect(result.success).toBe(true);
		expect(result.data).toEqual(input);
	});

	it("rejects config without address", () => {
		const input = {
			schedule: [{ type: "szkło", dates: ["2026-04-15"] }],
		};

		const result = WasteCollectionConfig.safeParse(input);
		expect(result.success).toBe(false);
	});

	it("rejects config with empty schedule", () => {
		const input = {
			address: "ul. Kwiatowa 5",
			schedule: [],
		};

		const result = WasteCollectionConfig.safeParse(input);
		expect(result.success).toBe(false);
	});

	it("rejects schedule entry with empty dates array", () => {
		const input = {
			address: "ul. Kwiatowa 5",
			schedule: [{ type: "szkło", dates: [] }],
		};

		const result = WasteCollectionConfig.safeParse(input);
		expect(result.success).toBe(false);
	});

	it("rejects schedule entry with invalid date format", () => {
		const input = {
			address: "ul. Kwiatowa 5",
			schedule: [{ type: "szkło", dates: ["15-04-2026"] }],
		};

		const result = WasteCollectionConfig.safeParse(input);
		expect(result.success).toBe(false);
	});
});
