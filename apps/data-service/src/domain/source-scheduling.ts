import type { SourceData } from "./notification";
import { computeNextAlarm as computeWasteAlarm } from "./waste-collection-handler";
import { computeNextAlarm as computeBirthdayAlarm } from "./birthday-handler";
import type { WasteCollectionConfig } from "./waste-collection-handler";
import type { BirthdayEntry } from "./birthday-handler";

export function computeNextAlarmForSource(
	source: SourceData,
	alertBeforeHours: number,
	timezone: string,
	now: Date,
): Date | null {
	if (source.type === "waste_collection") {
		const cfg = source.config as unknown as WasteCollectionConfig;
		return computeWasteAlarm(cfg.schedule, alertBeforeHours, timezone, now);
	}
	if (source.type === "birthday") {
		const cfg = source.config as unknown as { birthdays: BirthdayEntry[] };
		return computeBirthdayAlarm(cfg.birthdays, alertBeforeHours, timezone, now);
	}
	return null;
}
