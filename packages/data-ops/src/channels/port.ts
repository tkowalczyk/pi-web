import { z } from "zod";

export const ChannelErrorType = z.enum([
	"not_implemented",
	"feature_disabled",
	"delivery_failed",
	"invalid_payload",
]);
export type ChannelErrorType = z.infer<typeof ChannelErrorType>;

export class ChannelError extends Error {
	constructor(
		public readonly type: ChannelErrorType,
		message: string,
	) {
		super(message);
		this.name = "ChannelError";
	}
}

export const NotificationPayload = z.object({
	recipient: z.string(),
	subject: z.string(),
	body: z.string(),
	sourceId: z.number(),
	channelId: z.number(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});
export type NotificationPayload = z.infer<typeof NotificationPayload>;

export const DeliveryResult = z.object({
	success: z.boolean(),
	messageId: z.string().optional(),
	error: z.string().optional(),
	timestamp: z.date(),
});
export type DeliveryResult = z.infer<typeof DeliveryResult>;

export interface NotificationChannel {
	readonly name: string;
	send(payload: NotificationPayload): Promise<DeliveryResult>;
}
