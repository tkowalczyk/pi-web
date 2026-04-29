import { z } from "zod";
import { WasteCollectionConfig } from "./waste-collection-config";
import { BirthdayConfig } from "./birthday-config";

export const SOURCE_TYPES = [
	{ value: "waste_collection" as const, label: "Wywóz śmieci", icon: "🗑" },
	{ value: "birthday" as const, label: "Urodziny", icon: "🎂" },
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number]["value"];

const ALERT_DEFAULTS: Record<string, number> = {
	waste_collection: 6,
	birthday: 24,
};

export function getAlertBeforeHoursDefault(type: string): number {
	return ALERT_DEFAULTS[type] ?? 24;
}

const WasteCollectionForm = z.object({
	name: z.string().min(1),
	type: z.literal("waste_collection"),
	config: WasteCollectionConfig,
	alertBeforeHours: z.number().int().positive().optional(),
});

const BirthdayForm = z.object({
	name: z.string().min(1),
	type: z.literal("birthday"),
	config: BirthdayConfig,
	alertBeforeHours: z.number().int().positive().optional(),
});

export const SourceFormInput = z.discriminatedUnion("type", [WasteCollectionForm, BirthdayForm]);

export type SourceFormInput = z.infer<typeof SourceFormInput>;
