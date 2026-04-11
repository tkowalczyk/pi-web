import { describe, it, expect } from "vitest";
import { computeNextAlarm } from "./waste-collection-handler";

const schedule = [
	{ type: "szkło", dates: ["2026-04-15", "2026-04-29"] },
	{ type: "papier", dates: ["2026-04-20", "2026-05-04"] },
];

describe("computeNextAlarm", () => {
	it("returns correct UTC alarm for next collection date with alertBeforeHours", () => {
		// 2026-04-15 collection, alertBeforeHours=18, timezone=Europe/Warsaw (UTC+2 in April)
		// Alert should fire at: 2026-04-14 06:00 local = 2026-04-14 04:00 UTC
		const now = new Date("2026-04-10T12:00:00Z");
		const result = computeNextAlarm(schedule, 18, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result!.toISOString()).toBe("2026-04-14T04:00:00.000Z");
	});

	it("skips past dates and picks the next future alarm", () => {
		// now is after 2026-04-15 alarm time, so next should be 2026-04-20 (papier)
		// 2026-04-20 collection, alert 18h before = 2026-04-19 06:00 local = 2026-04-19 04:00 UTC
		const now = new Date("2026-04-15T10:00:00Z");
		const result = computeNextAlarm(schedule, 18, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result!.toISOString()).toBe("2026-04-19T04:00:00.000Z");
	});

	it("returns null when all dates are in the past", () => {
		const pastSchedule = [{ type: "szkło", dates: ["2026-01-10"] }];
		const now = new Date("2026-04-10T12:00:00Z");
		const result = computeNextAlarm(pastSchedule, 18, "Europe/Warsaw", now);

		expect(result).toBeNull();
	});

	it("handles DST spring forward (CET→CEST, last Sunday of March)", () => {
		// 2026-03-29 is Sunday — DST transition in Europe/Warsaw: clocks move 02:00→03:00
		// Collection on 2026-03-30, alertBeforeHours=18
		// Alert at: 2026-03-29 06:00 local (already CEST, UTC+2) = 2026-03-29 04:00 UTC
		const springSchedule = [{ type: "szkło", dates: ["2026-03-30"] }];
		const now = new Date("2026-03-25T12:00:00Z");
		const result = computeNextAlarm(springSchedule, 18, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		// 2026-03-30 00:00 local (CEST UTC+2) minus 18h = 2026-03-29 06:00 local = 2026-03-29 04:00 UTC
		expect(result!.toISOString()).toBe("2026-03-29T04:00:00.000Z");
	});

	it("handles DST fall back (CEST→CET, last Sunday of October)", () => {
		// 2026-10-25 is Sunday — DST transition: clocks move 03:00→02:00
		// Collection on 2026-10-26, alertBeforeHours=18
		// Alert at: 2026-10-25 06:00 local (CET UTC+1) = 2026-10-25 05:00 UTC
		const fallSchedule = [{ type: "papier", dates: ["2026-10-26"] }];
		const now = new Date("2026-10-20T12:00:00Z");
		const result = computeNextAlarm(fallSchedule, 18, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		// 2026-10-26 00:00 local (CET UTC+1) minus 18h = 2026-10-25 06:00 local = 2026-10-25 05:00 UTC
		expect(result!.toISOString()).toBe("2026-10-25T05:00:00.000Z");
	});

	it("deduplicates dates across schedule entries", () => {
		// Both types have 2026-04-20 — should only produce one alarm candidate
		const now = new Date("2026-04-16T12:00:00Z");
		const result = computeNextAlarm(schedule, 18, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		// Next unique date after now's alarm is 2026-04-20
		// 2026-04-20 alert = 2026-04-19 06:00 local (CEST, UTC+2) = 2026-04-19 04:00 UTC
		expect(result!.toISOString()).toBe("2026-04-19T04:00:00.000Z");
	});
});
