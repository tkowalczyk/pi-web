import type { WasteCollectionConfig } from "../../src/zod-schema/waste-collection-config";

interface RawSchedule {
	wasteCollectionSchedule: Record<string, Record<string, number[]>>;
}

interface TransformOpts {
	year: number;
	address: string;
}

export function transformWasteSchedule(
	raw: RawSchedule,
	opts: TransformOpts,
): WasteCollectionConfig {
	const { year, address } = opts;
	const monthMap = raw.wasteCollectionSchedule;

	const perType = new Map<string, string[]>();

	for (const monthKey of Object.keys(monthMap)) {
		const month = Number(monthKey);
		const monthEntry = monthMap[monthKey];
		for (const [type, days] of Object.entries(monthEntry)) {
			const list = perType.get(type) ?? [];
			for (const day of days) {
				list.push(`${year}-${pad(month)}-${pad(day)}`);
			}
			perType.set(type, list);
		}
	}

	const schedule = Array.from(perType.entries()).map(([type, dates]) => ({
		type,
		dates: dates.slice().sort(),
	}));

	return { address, schedule };
}

function pad(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}
