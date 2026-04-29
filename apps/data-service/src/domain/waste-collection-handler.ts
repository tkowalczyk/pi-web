export interface WasteScheduleEntry {
	type: string;
	dates: string[];
}

export interface WasteCollectionConfig {
	address: string;
	schedule: WasteScheduleEntry[];
}

const WASTE_TYPE_LABELS_PL: Record<string, string> = {
	mixed: "zmieszane",
	metalsAndPlastics: "metale i tworzywa",
	paper: "papier",
	glass: "szkło",
	bioWaste: "bio",
	christmasTrees: "choinki",
	bulkyWaste: "wielkogabarytowe",
};

function translateWasteType(type: string): string {
	return WASTE_TYPE_LABELS_PL[type] ?? type;
}

const MONTHS_PL = [
	"stycznia",
	"lutego",
	"marca",
	"kwietnia",
	"maja",
	"czerwca",
	"lipca",
	"sierpnia",
	"września",
	"października",
	"listopada",
	"grudnia",
];

function formatDatePl(isoDate: string): string {
	const [year, month, day] = isoDate.split("-").map(Number);
	return `${day} ${MONTHS_PL[month! - 1]} ${year}`;
}

/**
 * Pure function — renders HTML notification for waste collection.
 * Only includes waste types scheduled for the given collectionDate.
 */
export function renderMessage(config: WasteCollectionConfig, collectionDate: string): string {
	const matchingTypes = config.schedule
		.filter((entry) => entry.dates.includes(collectionDate))
		.map((entry) => translateWasteType(entry.type));

	const typesList = matchingTypes.join(", ");
	const datePl = formatDatePl(collectionDate);

	return `🗑 <b>Jutro wywóz: ${typesList}</b>\n${config.address}\n📅 ${datePl}`;
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

/**
 * Converts a local date string (YYYY-MM-DD) at midnight in the given timezone to a UTC Date.
 * DST-safe: computes the offset at midnight of that day.
 */
function localMidnightToUtc(isoDate: string, timezone: string): Date {
	// Start with a rough UTC estimate (midnight UTC)
	const roughUtc = new Date(`${isoDate}T00:00:00Z`);
	// Get the offset at that rough time
	const offsetMin = getTimezoneOffsetMinutes(timezone, roughUtc);
	// Midnight local = midnight UTC minus offset
	const midnightUtc = new Date(roughUtc.getTime() - offsetMin * 60_000);
	// Refine: check offset at the actual midnight UTC time (handles DST edge cases)
	const refinedOffset = getTimezoneOffsetMinutes(timezone, midnightUtc);
	if (refinedOffset !== offsetMin) {
		return new Date(roughUtc.getTime() - refinedOffset * 60_000);
	}
	return midnightUtc;
}

export interface ScheduledAlarm {
	alarm: Date;
	scheduledDate: string;
}

/**
 * Given a waste schedule, computes the next UTC alarm and the collection date
 * that alarm refers to. DST-safe using Intl.DateTimeFormat for timezone conversions.
 *
 * @param schedule - waste schedule entries with dates
 * @param alertBeforeHours - hours before midnight (collection day start) to fire alarm
 * @param timezone - IANA timezone (e.g. "Europe/Warsaw")
 * @param now - current time
 * @returns next alarm UTC Date paired with its collection date, or null if no future dates
 */
export function computeNextAlarm(
	schedule: WasteScheduleEntry[],
	alertBeforeHours: number,
	timezone: string,
	now: Date,
): ScheduledAlarm | null {
	const allDates = new Set<string>();
	for (const entry of schedule) {
		for (const d of entry.dates) {
			allDates.add(d);
		}
	}

	let earliest: { alarmMs: number; scheduledDate: string } | null = null;

	for (const isoDate of allDates) {
		const midnightUtc = localMidnightToUtc(isoDate, timezone);
		const alarmUtcMs = midnightUtc.getTime() - alertBeforeHours * 3_600_000;

		if (alarmUtcMs <= now.getTime()) continue;

		if (!earliest || alarmUtcMs < earliest.alarmMs) {
			earliest = { alarmMs: alarmUtcMs, scheduledDate: isoDate };
		}
	}

	if (!earliest) return null;

	return { alarm: new Date(earliest.alarmMs), scheduledDate: earliest.scheduledDate };
}
