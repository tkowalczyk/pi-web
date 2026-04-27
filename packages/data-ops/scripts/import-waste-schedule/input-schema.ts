import { z } from "zod";

const Day = z.number().int().min(1).max(31);
const MonthKey = z
	.string()
	.regex(/^\d+$/)
	.refine((s) => {
		const n = Number(s);
		return n >= 1 && n <= 12;
	}, "month key must be 1-12");

const MonthEntry = z.record(z.string(), z.array(Day));

export const RawWasteScheduleInput = z.object({
	region: z.string().min(1),
	addresses: z
		.array(
			z.object({
				city: z.string().min(1),
				streets: z.array(z.string()),
			}),
		)
		.optional()
		.default([]),
	wasteCollectionSchedule: z.record(MonthKey, MonthEntry),
	wasteTypes: z.record(z.string(), z.string()).optional(),
});

export type RawWasteScheduleInput = z.infer<typeof RawWasteScheduleInput>;
