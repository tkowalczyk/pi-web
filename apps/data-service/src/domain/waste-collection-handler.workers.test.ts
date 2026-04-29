import { describe, it, expect } from "vitest";
import { computeNextAlarm } from "./waste-collection-handler";

const schedule = [
	{ type: "szkło", dates: ["2026-04-15", "2026-04-29"] },
	{ type: "papier", dates: ["2026-04-20", "2026-05-04"] },
];

describe("computeNextAlarm", () => {
	it("returns correct UTC alarm and collection date for next pickup with alertBeforeHours", () => {
		// 2026-04-15 collection, alertBeforeHours=18, timezone=Europe/Warsaw (UTC+2 in April)
		// Alert should fire at: 2026-04-14 06:00 local = 2026-04-14 04:00 UTC
		const now = new Date("2026-04-10T12:00:00Z");
		const result = computeNextAlarm(schedule, 18, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result!.alarm.toISOString()).toBe("2026-04-14T04:00:00.000Z");
		expect(result!.scheduledDate).toBe("2026-04-15");
	});

	it("uses alertBeforeHours=6 to fire at 18:00 local of the day before", () => {
		// 2026-04-30 collection (CEST UTC+2), alertBeforeHours=6
		// Local midnight 2026-04-30 = 2026-04-29T22:00:00Z, minus 6h = 2026-04-29T16:00:00Z
		// = 2026-04-29 18:00 local — exactly the desired evening-before slot.
		const now = new Date("2026-04-25T12:00:00Z");
		const result = computeNextAlarm(
			[{ type: "mixed", dates: ["2026-04-30"] }],
			6,
			"Europe/Warsaw",
			now,
		);

		expect(result).not.toBeNull();
		expect(result!.alarm.toISOString()).toBe("2026-04-29T16:00:00.000Z");
		expect(result!.scheduledDate).toBe("2026-04-30");
	});

	it("skips past dates and picks the next future alarm", () => {
		const now = new Date("2026-04-15T10:00:00Z");
		const result = computeNextAlarm(schedule, 18, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result!.alarm.toISOString()).toBe("2026-04-19T04:00:00.000Z");
		expect(result!.scheduledDate).toBe("2026-04-20");
	});

	it("returns null when all dates are in the past", () => {
		const pastSchedule = [{ type: "szkło", dates: ["2026-01-10"] }];
		const now = new Date("2026-04-10T12:00:00Z");
		const result = computeNextAlarm(pastSchedule, 18, "Europe/Warsaw", now);

		expect(result).toBeNull();
	});

	it("handles DST spring forward (CET→CEST, last Sunday of March)", () => {
		const springSchedule = [{ type: "szkło", dates: ["2026-03-30"] }];
		const now = new Date("2026-03-25T12:00:00Z");
		const result = computeNextAlarm(springSchedule, 18, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result!.alarm.toISOString()).toBe("2026-03-29T04:00:00.000Z");
		expect(result!.scheduledDate).toBe("2026-03-30");
	});

	it("handles DST fall back (CEST→CET, last Sunday of October)", () => {
		const fallSchedule = [{ type: "papier", dates: ["2026-10-26"] }];
		const now = new Date("2026-10-20T12:00:00Z");
		const result = computeNextAlarm(fallSchedule, 18, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result!.alarm.toISOString()).toBe("2026-10-25T05:00:00.000Z");
		expect(result!.scheduledDate).toBe("2026-10-26");
	});

	it("deduplicates dates across schedule entries", () => {
		const now = new Date("2026-04-16T12:00:00Z");
		const result = computeNextAlarm(schedule, 18, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result!.alarm.toISOString()).toBe("2026-04-19T04:00:00.000Z");
		expect(result!.scheduledDate).toBe("2026-04-20");
	});
});
