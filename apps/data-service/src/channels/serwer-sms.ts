import {
	ChannelError,
	type NotificationChannel,
	type NotificationPayload,
	type DeliveryResult,
} from "@repo/data-ops/channels/port";
import { sendSms as defaultSendSms } from "../hono/services/sms";

type SendSmsFn = (
	apiToken: string,
	phoneNumber: string,
	message: string,
	senderName?: string,
) => Promise<{ messageId: string; parts: number; status: string } | { error: string }>;

export interface SerwerSMSChannelConfig {
	apiToken: string;
	senderName: string;
	featureEnabled: boolean;
	sendSmsFn?: SendSmsFn;
}

export class SerwerSMSChannel implements NotificationChannel {
	readonly name = "serwer-sms";
	private readonly config: SerwerSMSChannelConfig;
	private readonly sendSmsFn: SendSmsFn;

	constructor(config: SerwerSMSChannelConfig) {
		this.config = config;
		this.sendSmsFn = config.sendSmsFn ?? defaultSendSms;
	}

	async send(payload: NotificationPayload): Promise<DeliveryResult> {
		if (!this.config.featureEnabled) {
			throw new ChannelError(
				"feature_disabled",
				"SMS channel is disabled — set FEATURE_SMS_ENABLED=true to enable",
			);
		}

		const result = await this.sendSmsFn(
			this.config.apiToken,
			payload.recipient,
			payload.body,
			this.config.senderName,
		);

		if ("error" in result) {
			return {
				success: false,
				error: result.error,
				timestamp: new Date(),
			};
		}

		return {
			success: true,
			messageId: result.messageId,
			timestamp: new Date(),
		};
	}
}
