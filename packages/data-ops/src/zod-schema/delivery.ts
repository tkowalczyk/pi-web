import { z } from "zod";

export const InsertDeliveryLog = z.object({
	sourceId: z.number(),
	channel: z.string(),
	status: z.string(),
	error: z.string().optional(),
	retryCount: z.number().default(0),
});

export type InsertDeliveryLog = z.infer<typeof InsertDeliveryLog>;

export const InsertDeliveryFailure = z.object({
	sourceId: z.number(),
	channel: z.string(),
	error: z.string(),
	retryCount: z.number(),
	payload: z.record(z.string(), z.unknown()),
});

export type InsertDeliveryFailure = z.infer<typeof InsertDeliveryFailure>;
