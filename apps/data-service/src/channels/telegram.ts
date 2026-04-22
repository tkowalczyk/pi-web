import type {
	NotificationChannel,
	NotificationPayload,
	DeliveryResult,
} from "@repo/data-ops/channels/port";

export interface DeliveryLogger {
	logDelivery(entry: {
		sourceId: number;
		channel: string;
		status: string;
		error?: string;
		retryCount: number;
	}): void;
	logFailure(entry: {
		sourceId: number;
		channel: string;
		error: string;
		retryCount: number;
		payload: NotificationPayload;
	}): void;
}

export interface TelegramChannelConfig {
	botToken: string;
	fetchFn?: typeof fetch;
	logger?: DeliveryLogger;
}

const RETRY_DELAYS = [1000, 4000, 16000];
const MAX_RETRIES = 3;

function isTransient(status: number): boolean {
	return status === 429 || (status >= 500 && status < 600);
}

type AttemptResult =
	| { outcome: "success"; result: DeliveryResult }
	| { outcome: "retry"; error: string }
	| { outcome: "fail"; error: string };

export class TelegramChannel implements NotificationChannel {
	readonly name = "telegram";
	private readonly botToken: string;
	private readonly fetchFn: typeof fetch;
	private readonly logger?: DeliveryLogger;

	constructor(config: TelegramChannelConfig) {
		this.botToken = config.botToken;
		this.fetchFn = config.fetchFn ?? globalThis.fetch.bind(globalThis);
		this.logger = config.logger;
	}

	async send(payload: NotificationPayload): Promise<DeliveryResult> {
		const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
		const body: Record<string, unknown> = {
			chat_id: payload.recipient,
			text: payload.body,
			parse_mode: "HTML",
		};
		if (payload.metadata?.message_thread_id) {
			body.message_thread_id = payload.metadata.message_thread_id;
		}

		let lastError: string | undefined;
		let retryCount = 0;

		for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
			const r = await this.attempt(url, body, attempt);

			if (r.outcome === "success") {
				this.logger?.logDelivery({
					sourceId: payload.sourceId,
					channel: this.name,
					status: "success",
					retryCount,
				});
				return r.result;
			}

			lastError = r.error;
			if (r.outcome === "retry") {
				retryCount = attempt + 1;
				await this.delay(RETRY_DELAYS[attempt]);
				continue;
			}
			break;
		}

		this.logger?.logDelivery({
			sourceId: payload.sourceId,
			channel: this.name,
			status: "failure",
			error: lastError,
			retryCount,
		});
		this.logger?.logFailure({
			sourceId: payload.sourceId,
			channel: this.name,
			error: lastError ?? "unknown error",
			retryCount,
			payload,
		});

		return { success: false, error: lastError, timestamp: new Date() };
	}

	private async attempt(
		url: string,
		body: Record<string, unknown>,
		attempt: number,
	): Promise<AttemptResult> {
		try {
			const response = await this.fetchFn(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (response.ok) {
				const data = (await response.json()) as { result: { message_id: number } };
				return {
					outcome: "success",
					result: {
						success: true,
						messageId: String(data.result.message_id),
						timestamp: new Date(),
					},
				};
			}

			if (isTransient(response.status) && attempt < MAX_RETRIES) {
				return { outcome: "retry", error: `HTTP ${response.status}` };
			}

			const errorText = await response.text();
			return { outcome: "fail", error: `HTTP ${response.status}: ${errorText}` };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (attempt < MAX_RETRIES) {
				return { outcome: "retry", error: msg };
			}
			return { outcome: "fail", error: msg };
		}
	}

	async createForumTopic(
		chatId: string,
		name: string,
		iconCustomEmojiId?: string,
	): Promise<number> {
		const url = `https://api.telegram.org/bot${this.botToken}/createForumTopic`;
		const body: Record<string, unknown> = { chat_id: chatId, name };
		if (iconCustomEmojiId) {
			body.icon_custom_emoji_id = iconCustomEmojiId;
		}

		const response = await this.fetchFn(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`createForumTopic failed: HTTP ${response.status}: ${text}`);
		}

		const data = (await response.json()) as { result: { message_thread_id: number } };
		return data.result.message_thread_id;
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
