import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { transformWasteSchedule } from "./transform";
import { WasteCollectionConfig } from "../../src/zod-schema/waste-collection-config";

describe("transformWasteSchedule", () => {
	it("synthesizes one ISO date from one month + one type + one day", () => {
		const raw = {
			region: "Gmina X",
			addresses: [{ city: "X", streets: ["A"] }],
			wasteCollectionSchedule: {
				"1": { mixed: [14] },
			},
		};

		const result = transformWasteSchedule(raw, { year: 2026, address: "X, ul. A" });

		expect(result).toEqual({
			address: "X, ul. A",
			schedule: [{ type: "mixed", dates: ["2026-01-14"] }],
		});
	});

	it("zero-pads single-digit months and days", () => {
		const raw = {
			region: "X",
			addresses: [],
			wasteCollectionSchedule: {
				"1": { metalsAndPlastics: [5] },
			},
		};

		const result = transformWasteSchedule(raw, { year: 2026, address: "X" });

		expect(result.schedule[0]?.dates).toEqual(["2026-01-05"]);
	});

	it("accumulates dates for the same type across multiple months sorted ASC", () => {
		const raw = {
			region: "X",
			addresses: [],
			wasteCollectionSchedule: {
				"3": { mixed: [11, 25] },
				"1": { mixed: [14, 28] },
				"2": { mixed: [11, 25] },
			},
		};

		const result = transformWasteSchedule(raw, { year: 2026, address: "X" });

		const mixed = result.schedule.find((s) => s.type === "mixed");
		expect(mixed?.dates).toEqual([
			"2026-01-14",
			"2026-01-28",
			"2026-02-11",
			"2026-02-25",
			"2026-03-11",
			"2026-03-25",
		]);
	});

	it("includes optional types only when present in input", () => {
		const raw = {
			region: "X",
			addresses: [],
			wasteCollectionSchedule: {
				"2": { mixed: [11], christmasTrees: [24] },
				"3": { mixed: [11], bulkyWaste: [19] },
				"4": { mixed: [8] },
			},
		};

		const result = transformWasteSchedule(raw, { year: 2026, address: "X" });

		const types = result.schedule.map((s) => s.type).sort();
		expect(types).toEqual(["bulkyWaste", "christmasTrees", "mixed"]);

		const byType = Object.fromEntries(result.schedule.map((s) => [s.type, s.dates]));
		expect(byType.christmasTrees).toEqual(["2026-02-24"]);
		expect(byType.bulkyWaste).toEqual(["2026-03-19"]);
	});

	it("produces output that validates against existing WasteCollectionConfig zod (real fixture)", () => {
		const fixturePath = path.resolve(__dirname, "../../../../.data-to-import/raw/2026_4.json");
		const raw = JSON.parse(readFileSync(fixturePath, "utf-8"));

		const result = transformWasteSchedule(raw, {
			year: 2026,
			address: "Nieporęt, ul. Agawy",
		});

		const parsed = WasteCollectionConfig.safeParse(result);
		expect(parsed.success).toBe(true);
		expect(result.address).toBe("Nieporęt, ul. Agawy");
		expect(result.schedule.length).toBeGreaterThan(0);
	});

	it("groups multiple types from one month into separate schedule entries", () => {
		const raw = {
			region: "X",
			addresses: [],
			wasteCollectionSchedule: {
				"1": { mixed: [14, 28], paper: [19], glass: [16] },
			},
		};

		const result = transformWasteSchedule(raw, { year: 2026, address: "X" });

		const byType = Object.fromEntries(result.schedule.map((s) => [s.type, s.dates]));
		expect(byType.mixed).toEqual(["2026-01-14", "2026-01-28"]);
		expect(byType.paper).toEqual(["2026-01-19"]);
		expect(byType.glass).toEqual(["2026-01-16"]);
	});
});
