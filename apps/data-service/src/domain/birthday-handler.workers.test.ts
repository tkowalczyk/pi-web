import { describe, it, expect } from "vitest";
import { computeNextAlarm } from "./birthday-handler";

const birthdays = [
	{ name: "Mama", date: "03-15" },
	{ name: "Tata", date: "11-02" },
];

describe("BirthdayHandler.computeNextAlarm", () => {
	it("returns alarm 24h before the next upcoming birthday", () => {
		// Next birthday: Mama on March 15, 2027 (now is April 2026, so Mama's 2026 date passed)
		// Actually March 15 2026 hasn't... wait, now is Jan 10 2026 so next is Mama March 15 2026
		// Alarm: March 14 00:00 local (Europe/Warsaw UTC+1 in Jan) = March 13 23:00 UTC
		// Wait — alertBeforeHours=24 means alarm at March 14 00:00 local
		// March is CET→CEST transition on last Sunday. March 15 is before March 29 2026 (DST switch)
		// So still CET (UTC+1): March 14 00:00 local = March 13 23:00 UTC
		const now = new Date("2026-01-10T12:00:00Z");
		const result = computeNextAlarm(birthdays, 24, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		// March 15 midnight local (CET, UTC+1) minus 24h = March 14 00:00 local = March 13 23:00 UTC
		expect(result?.toISOString()).toBe("2026-03-13T23:00:00.000Z");
	});

	it("skips past birthdays this year and picks next one", () => {
		// Now is April 13 2026. Mama's Mar 15 already passed. Next: Tata Nov 2
		// Nov 2 midnight local (CET, UTC+1) minus 24h = Nov 1 00:00 local = Oct 31 23:00 UTC
		const now = new Date("2026-04-13T12:00:00Z");
		const result = computeNextAlarm(birthdays, 24, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		// Nov 2 2026 midnight (CET UTC+1) - 24h = Nov 1 00:00 CET = Oct 31 23:00 UTC
		expect(result?.toISOString()).toBe("2026-10-31T23:00:00.000Z");
	});

	it("wraps to next year when all birthdays this year have passed", () => {
		// Now is Dec 1 2026. Both Mama (Mar 15) and Tata (Nov 2) passed.
		// Next: Mama Mar 15 2027
		// March 15 2027: CET (UTC+1), March 28 is DST switch → still CET
		// Midnight CET = March 14 23:00 UTC, minus 24h = March 13 23:00 UTC
		const now = new Date("2026-12-01T12:00:00Z");
		const result = computeNextAlarm(birthdays, 24, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result?.toISOString()).toBe("2027-03-13T23:00:00.000Z");
	});

	it("handles DST spring forward correctly", () => {
		// Birthday on April 1, 2026 — after DST switch (March 29)
		// CEST (UTC+2): April 1 midnight local = March 31 22:00 UTC
		// Minus 24h = March 30 22:00 UTC
		const springBirthdays = [{ name: "Ola", date: "04-01" }];
		const now = new Date("2026-03-01T12:00:00Z");
		const result = computeNextAlarm(springBirthdays, 24, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result?.toISOString()).toBe("2026-03-30T22:00:00.000Z");
	});

	it("handles DST fall back correctly", () => {
		// Birthday on Nov 1, 2026 — after DST switch back (Oct 25)
		// CET (UTC+1): Nov 1 midnight local = Oct 31 23:00 UTC
		// Minus 24h = Oct 30 23:00 UTC
		const fallBirthdays = [{ name: "Piotr", date: "11-01" }];
		const now = new Date("2026-10-01T12:00:00Z");
		const result = computeNextAlarm(fallBirthdays, 24, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result?.toISOString()).toBe("2026-10-30T23:00:00.000Z");
	});

	it("handles Feb 29 birthday in a non-leap year by using March 1", () => {
		// 2027 is not a leap year. Feb 29 birthday → treat as March 1
		// March 1 2027 midnight CET (UTC+1) = Feb 28 23:00 UTC
		// Minus 24h = Feb 27 23:00 UTC
		const leapBirthdays = [{ name: "Leap baby", date: "02-29" }];
		const now = new Date("2027-01-10T12:00:00Z");
		const result = computeNextAlarm(leapBirthdays, 24, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result?.toISOString()).toBe("2027-02-27T23:00:00.000Z");
	});

	it("handles Feb 29 birthday in a leap year correctly", () => {
		// 2028 is a leap year. Feb 29 exists.
		// Feb 29 2028 midnight CET (UTC+1) = Feb 28 23:00 UTC
		// Minus 24h = Feb 27 23:00 UTC
		const leapBirthdays = [{ name: "Leap baby", date: "02-29" }];
		const now = new Date("2028-01-10T12:00:00Z");
		const result = computeNextAlarm(leapBirthdays, 24, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result?.toISOString()).toBe("2028-02-27T23:00:00.000Z");
	});

	it("returns null for empty birthdays array", () => {
		const result = computeNextAlarm([], 24, "Europe/Warsaw", new Date());
		expect(result).toBeNull();
	});

	it("supports custom alertBeforeHours", () => {
		// Mama Mar 15, alertBeforeHours=48 (2 days before)
		// Mar 15 midnight CET (UTC+1) = Mar 14 23:00 UTC, minus 48h = Mar 12 23:00 UTC
		const now = new Date("2026-01-10T12:00:00Z");
		const result = computeNextAlarm(birthdays, 48, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result?.toISOString()).toBe("2026-03-12T23:00:00.000Z");
	});
});
