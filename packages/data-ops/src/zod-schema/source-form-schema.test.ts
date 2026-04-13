import { describe, it, expect } from "vitest";
import {
	SourceFormInput,
	getAlertBeforeHoursDefault,
	SOURCE_TYPES,
} from "./source-form-schema";

describe("SourceFormInput zod schema", () => {
	it("accepts valid waste_collection input", () => {
		const result = SourceFormInput.safeParse({
			name: "Wywóz śmieci",
			type: "waste_collection",
			config: {
				address: "ul. Kwiatowa 5",
				schedule: [{ type: "szkło", dates: ["2026-04-15"] }],
			},
		});
		expect(result.success).toBe(true);
	});

	it("accepts valid birthday input", () => {
		const result = SourceFormInput.safeParse({
			name: "Urodziny rodziny",
			type: "birthday",
			config: {
				birthdays: [{ name: "Mama", date: "03-15" }],
			},
		});
		expect(result.success).toBe(true);
	});

	it("rejects waste_collection with birthday config", () => {
		const result = SourceFormInput.safeParse({
			name: "Test",
			type: "waste_collection",
			config: {
				birthdays: [{ name: "Mama", date: "03-15" }],
			},
		});
		expect(result.success).toBe(false);
	});

	it("rejects birthday with waste_collection config", () => {
		const result = SourceFormInput.safeParse({
			name: "Test",
			type: "birthday",
			config: {
				address: "ul. Kwiatowa 5",
				schedule: [{ type: "szkło", dates: ["2026-04-15"] }],
			},
		});
		expect(result.success).toBe(false);
	});

	it("accepts custom alertBeforeHours", () => {
		const result = SourceFormInput.safeParse({
			name: "Test",
			type: "waste_collection",
			config: {
				address: "ul. Kwiatowa 5",
				schedule: [{ type: "szkło", dates: ["2026-04-15"] }],
			},
			alertBeforeHours: 12,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.alertBeforeHours).toBe(12);
		}
	});

	it("rejects negative alertBeforeHours", () => {
		const result = SourceFormInput.safeParse({
			name: "Test",
			type: "waste_collection",
			config: {
				address: "ul. Kwiatowa 5",
				schedule: [{ type: "szkło", dates: ["2026-04-15"] }],
			},
			alertBeforeHours: -1,
		});
		expect(result.success).toBe(false);
	});

	it("rejects empty name", () => {
		const result = SourceFormInput.safeParse({
			name: "",
			type: "waste_collection",
			config: {
				address: "ul. Kwiatowa 5",
				schedule: [{ type: "szkło", dates: ["2026-04-15"] }],
			},
		});
		expect(result.success).toBe(false);
	});
});

describe("getAlertBeforeHoursDefault", () => {
	it("returns 18 for waste_collection", () => {
		expect(getAlertBeforeHoursDefault("waste_collection")).toBe(18);
	});

	it("returns 24 for birthday", () => {
		expect(getAlertBeforeHoursDefault("birthday")).toBe(24);
	});

	it("returns 24 for unknown type", () => {
		expect(getAlertBeforeHoursDefault("unknown")).toBe(24);
	});
});

describe("SOURCE_TYPES", () => {
	it("contains waste_collection and birthday", () => {
		expect(SOURCE_TYPES).toContainEqual(
			expect.objectContaining({ value: "waste_collection" }),
		);
		expect(SOURCE_TYPES).toContainEqual(
			expect.objectContaining({ value: "birthday" }),
		);
	});
});
