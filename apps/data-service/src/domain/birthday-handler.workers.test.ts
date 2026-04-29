import { describe, it, expect } from "vitest";
import { computeNextAlarm } from "./birthday-handler";

const birthdays = [
	{ name: "Mama", date: "03-15" },
	{ name: "Tata", date: "11-02" },
];

describe("BirthdayHandler.computeNextAlarm", () => {
	it("returns alarm 24h before the next upcoming birthday paired with its date", () => {
		const now = new Date("2026-01-10T12:00:00Z");
		const result = computeNextAlarm(birthdays, 24, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result?.alarm.toISOString()).toBe("2026-03-13T23:00:00.000Z");
		expect(result?.scheduledDate).toBe("2026-03-15");
	});

	it("skips past birthdays this year and picks next one", () => {
		const now = new Date("2026-04-13T12:00:00Z");
		const result = computeNextAlarm(birthdays, 24, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result?.alarm.toISOString()).toBe("2026-10-31T23:00:00.000Z");
		expect(result?.scheduledDate).toBe("2026-11-02");
	});

	it("wraps to next year when all birthdays this year have passed", () => {
		const now = new Date("2026-12-01T12:00:00Z");
		const result = computeNextAlarm(birthdays, 24, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result?.alarm.toISOString()).toBe("2027-03-13T23:00:00.000Z");
		expect(result?.scheduledDate).toBe("2027-03-15");
	});

	it("handles DST spring forward correctly", () => {
		const springBirthdays = [{ name: "Ola", date: "04-01" }];
		const now = new Date("2026-03-01T12:00:00Z");
		const result = computeNextAlarm(springBirthdays, 24, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result?.alarm.toISOString()).toBe("2026-03-30T22:00:00.000Z");
		expect(result?.scheduledDate).toBe("2026-04-01");
	});

	it("handles DST fall back correctly", () => {
		const fallBirthdays = [{ name: "Piotr", date: "11-01" }];
		const now = new Date("2026-10-01T12:00:00Z");
		const result = computeNextAlarm(fallBirthdays, 24, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result?.alarm.toISOString()).toBe("2026-10-30T23:00:00.000Z");
		expect(result?.scheduledDate).toBe("2026-11-01");
	});

	it("handles Feb 29 birthday in a non-leap year by using March 1", () => {
		const leapBirthdays = [{ name: "Leap baby", date: "02-29" }];
		const now = new Date("2027-01-10T12:00:00Z");
		const result = computeNextAlarm(leapBirthdays, 24, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result?.alarm.toISOString()).toBe("2027-02-27T23:00:00.000Z");
		expect(result?.scheduledDate).toBe("2027-03-01");
	});

	it("handles Feb 29 birthday in a leap year correctly", () => {
		const leapBirthdays = [{ name: "Leap baby", date: "02-29" }];
		const now = new Date("2028-01-10T12:00:00Z");
		const result = computeNextAlarm(leapBirthdays, 24, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result?.alarm.toISOString()).toBe("2028-02-27T23:00:00.000Z");
		expect(result?.scheduledDate).toBe("2028-02-29");
	});

	it("returns null for empty birthdays array", () => {
		const result = computeNextAlarm([], 24, "Europe/Warsaw", new Date());
		expect(result).toBeNull();
	});

	it("supports custom alertBeforeHours", () => {
		const now = new Date("2026-01-10T12:00:00Z");
		const result = computeNextAlarm(birthdays, 48, "Europe/Warsaw", now);

		expect(result).not.toBeNull();
		expect(result?.alarm.toISOString()).toBe("2026-03-12T23:00:00.000Z");
		expect(result?.scheduledDate).toBe("2026-03-15");
	});
});
