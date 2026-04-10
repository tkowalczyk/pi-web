import { z } from "zod";

export const JsonConfig = z.record(z.string(), z.any());

export const ChannelResponse = z.object({
	id: z.number(),
	householdId: z.number(),
	type: z.string(),
	config: JsonConfig,
	enabled: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type ChannelResponse = z.infer<typeof ChannelResponse>;

export const CreateChannelInput = z.object({
	householdId: z.number(),
	type: z.string(),
	config: JsonConfig.default({}),
	enabled: z.boolean().optional(),
});

export type CreateChannelInput = z.infer<typeof CreateChannelInput>;

export const UpdateChannelInput = z.object({
	type: z.string().optional(),
	config: JsonConfig.optional(),
	enabled: z.boolean().optional(),
});

export type UpdateChannelInput = z.infer<typeof UpdateChannelInput>;
