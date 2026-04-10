import {
	ChannelError,
	type NotificationChannel,
	type NotificationPayload,
	type DeliveryResult,
} from "@repo/data-ops/channels/port";

export class TelegramChannel implements NotificationChannel {
	readonly name = "telegram";

	async send(_payload: NotificationPayload): Promise<DeliveryResult> {
		throw new ChannelError(
			"not_implemented",
			"Telegram channel is not yet implemented — planned for M2",
		);
	}
}
