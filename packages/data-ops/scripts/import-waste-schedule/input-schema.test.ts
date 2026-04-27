import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { RawWasteScheduleInput } from "./input-schema";

describe("RawWasteScheduleInput zod schema", () => {
	it("accepts the canonical real .data-to-import/raw/2026_4.json shape", () => {
		const fixturePath = path.resolve(__dirname, "../../../../.data-to-import/raw/2026_4.json");
		const raw = JSON.parse(readFileSync(fixturePath, "utf-8"));

		const result = RawWasteScheduleInput.safeParse(raw);
		expect(result.success).toBe(true);
	});

	it("rejects input with missing region", () => {
		const result = RawWasteScheduleInput.safeParse({
			addresses: [],
			wasteCollectionSchedule: { "1": { mixed: [14] } },
		});
		expect(result.success).toBe(false);
	});

	it("rejects month key out of 1-12 range", () => {
		const result = RawWasteScheduleInput.safeParse({
			region: "X",
			addresses: [],
			wasteCollectionSchedule: { "13": { mixed: [14] } },
		});
		expect(result.success).toBe(false);
	});

	it("rejects non-numeric day arrays", () => {
		const result = RawWasteScheduleInput.safeParse({
			region: "X",
			addresses: [],
			wasteCollectionSchedule: { "1": { mixed: ["14"] } },
		});
		expect(result.success).toBe(false);
	});

	it("rejects day numbers outside 1-31 range", () => {
		const result = RawWasteScheduleInput.safeParse({
			region: "X",
			addresses: [],
			wasteCollectionSchedule: { "1": { mixed: [32] } },
		});
		expect(result.success).toBe(false);
	});
});
