import { describe, it, expect } from "vitest";
import { computeNextAlarmForSource } from "./source-scheduling";
import type { SourceData } from "./notification";

const TZ = "Europe/Warsaw";
const NOW = new Date("2026-04-27T12:00:00Z");

describe("computeNextAlarmForSource", () => {
	it("dispatches waste_collection to the date-list computer (alertBeforeHours=18)", () => {
		const source: SourceData = {
			id: 1,
			name: "Wywóz",
			type: "waste_collection",
			config: {
				address: "ul. X",
				schedule: [{ type: "metalsAndPlastics", dates: ["2026-04-30"] }],
			},
		};

		const alarm = computeNextAlarmForSource(source, 18, TZ, NOW);

		// Local midnight 2026-04-30 in Europe/Warsaw (CEST, UTC+2) = 2026-04-29T22:00:00Z
		// minus 18h = 2026-04-29T04:00:00Z = 2026-04-29 06:00 CEST
		expect(alarm).toEqual(new Date("2026-04-29T04:00:00.000Z"));
	});

	it("dispatches birthday to the birthday-list computer", () => {
		const source: SourceData = {
			id: 2,
			name: "Urodziny",
			type: "birthday",
			config: { birthdays: [{ name: "Mama", date: "05-01" }] },
		};

		const alarm = computeNextAlarmForSource(source, 24, TZ, NOW);

		// Birthday Mama on 2026-05-01, alarm 24h before local midnight = 2026-04-30 00:00 CEST = 2026-04-29T22:00:00Z
		expect(alarm).toEqual(new Date("2026-04-29T22:00:00.000Z"));
	});

	it("returns null for unknown / generic source types", () => {
		const source: SourceData = {
			id: 3,
			name: "Generic",
			type: "generic",
			config: { message: "hi" },
		};

		expect(computeNextAlarmForSource(source, 24, TZ, NOW)).toBeNull();
	});

	it("returns null when waste_collection has no future dates", () => {
		const source: SourceData = {
			id: 4,
			name: "Past",
			type: "waste_collection",
			config: {
				address: "ul. Y",
				schedule: [{ type: "mixed", dates: ["2024-01-01"] }],
			},
		};

		expect(computeNextAlarmForSource(source, 18, TZ, NOW)).toBeNull();
	});
});
