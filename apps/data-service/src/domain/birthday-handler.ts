import type { BirthdayConfig } from "@repo/data-ops/zod-schema/birthday-config";

export interface BirthdayEntry {
	name: string;
	date: string;
}

/**
 * Pure function — renders HTML notification for a birthday.
 */
export function renderMessage(_config: BirthdayConfig, birthdayName: string): string {
	return `🎂 <b>Dziś urodziny: ${birthdayName}</b>\nPamiętaj o życzeniach!`;
}

/**
 * Computes the UTC offset in minutes for a given timezone at a specific UTC time.
 * Uses Intl.DateTimeFormat — works in CF Workers, Node.js, and all modern runtimes.
 */
function getTimezoneOffsetMinutes(timezone: string, utcDate: Date): number {
	const fmt = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});

	const parts = fmt.formatToParts(utcDate);
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);

	const localDate = new Date(
		Date.UTC(
			get("year"),
			get("month") - 1,
			get("day"),
			get("hour") % 24,
			get("minute"),
			get("second"),
		),
	);

	return (localDate.getTime() - utcDate.getTime()) / 60_000;
}

function localMidnightToUtc(isoDate: string, timezone: string): Date {
	const roughUtc = new Date(`${isoDate}T00:00:00Z`);
	const offsetMin = getTimezoneOffsetMinutes(timezone, roughUtc);
	const midnightUtc = new Date(roughUtc.getTime() - offsetMin * 60_000);
	const refinedOffset = getTimezoneOffsetMinutes(timezone, midnightUtc);
	if (refinedOffset !== offsetMin) {
		return new Date(roughUtc.getTime() - refinedOffset * 60_000);
	}
	return midnightUtc;
}

function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function resolveBirthdayDate(monthDay: string, year: number): string {
	const [month, day] = monthDay.split("-").map(Number);
	if (month === 2 && day === 29 && !isLeapYear(year)) {
		return `${year}-03-01`;
	}
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Given birthday entries, computes the next UTC alarm timestamp.
 * DST-safe. Birthdays repeat yearly; Feb 29 in non-leap years resolves to March 1.
 *
 * @param birthdays - birthday entries with name and MM-DD date
 * @param alertBeforeHours - hours before midnight (birthday start) to fire alarm
 * @param timezone - IANA timezone (e.g. "Europe/Warsaw")
 * @param now - current time
 * @returns next alarm as UTC Date, or null if no birthdays
 */
export function computeNextAlarm(
	birthdays: BirthdayEntry[],
	alertBeforeHours: number,
	timezone: string,
	now: Date,
): Date | null {
	if (birthdays.length === 0) return null;

	const currentYear = now.getUTCFullYear();
	let earliestMs = Number.POSITIVE_INFINITY;

	for (const entry of birthdays) {
		for (const year of [currentYear, currentYear + 1]) {
			const isoDate = resolveBirthdayDate(entry.date, year);
			const midnightUtc = localMidnightToUtc(isoDate, timezone);
			const alarmUtcMs = midnightUtc.getTime() - alertBeforeHours * 3_600_000;

			if (alarmUtcMs <= now.getTime()) continue;

			if (alarmUtcMs < earliestMs) {
				earliestMs = alarmUtcMs;
			}
		}
	}

	if (earliestMs === Number.POSITIVE_INFINITY) return null;

	return new Date(earliestMs);
}
