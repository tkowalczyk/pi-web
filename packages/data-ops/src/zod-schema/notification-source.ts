import { z } from "zod";

const JsonConfig = z.record(z.string(), z.any());

export const NotificationSourceResponse = z.object({
	id: z.number(),
	householdId: z.number(),
	name: z.string(),
	type: z.string(),
	config: JsonConfig,
	enabled: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type NotificationSourceResponse = z.infer<typeof NotificationSourceResponse>;

export const CreateNotificationSourceInput = z.object({
	householdId: z.number(),
	name: z.string(),
	type: z.string(),
	config: JsonConfig.default({}),
	enabled: z.boolean().optional(),
});

export type CreateNotificationSourceInput = z.infer<typeof CreateNotificationSourceInput>;

export const UpdateNotificationSourceInput = z.object({
	name: z.string().optional(),
	type: z.string().optional(),
	config: JsonConfig.optional(),
	enabled: z.boolean().optional(),
});

export type UpdateNotificationSourceInput = z.infer<typeof UpdateNotificationSourceInput>;
