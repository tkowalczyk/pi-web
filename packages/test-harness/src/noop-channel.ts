export interface NoopNotificationPayload {
	recipient: string;
	subject: string;
	body: string;
	sourceId: number;
	channelId: number;
	metadata?: Record<string, unknown>;
}

export interface NoopDeliveryResult {
	success: boolean;
	messageId?: string;
	error?: string;
	timestamp: Date;
}

export interface NoopInvocation {
	payload: NoopNotificationPayload;
	result: NoopDeliveryResult;
}

export class NoopChannel {
	readonly name = "noop";
	private _invocations: NoopInvocation[] = [];

	get invocations(): readonly NoopInvocation[] {
		return this._invocations;
	}

	async send(payload: NoopNotificationPayload): Promise<NoopDeliveryResult> {
		const result: NoopDeliveryResult = {
			success: true,
			messageId: `noop-${this._invocations.length + 1}`,
			timestamp: new Date(),
		};
		this._invocations.push({ payload, result });
		return result;
	}

	reset(): void {
		this._invocations = [];
	}
}
