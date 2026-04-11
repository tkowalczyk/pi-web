import { z } from "zod";

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const WasteScheduleEntry = z.object({
	type: z.string().min(1),
	dates: z.array(IsoDate).min(1),
});

export const WasteCollectionConfig = z.object({
	address: z.string().min(1),
	schedule: z.array(WasteScheduleEntry).min(1),
});

export type WasteCollectionConfig = z.infer<typeof WasteCollectionConfig>;
