import type { NotificationChannel, NotificationPayload } from "@repo/data-ops/channels/port";

export interface SelfAlertDeps {
	getRecentFailureCount(since: Date): Promise<number>;
	getRecentFailureSources(since: Date): Promise<string[]>;
	channel: NotificationChannel;
	threshold: number;
	recipient: string;
	channelId: number;
	getOrCreateSystemTopicId(): Promise<number>;
}

export async function handleSelfAlert(deps: SelfAlertDeps): Promise<void> {
	const since = new Date(Date.now() - 60 * 60 * 1000);
	const failureCount = await deps.getRecentFailureCount(since);

	if (failureCount <= deps.threshold) {
		return;
	}

	const sourceNames = await deps.getRecentFailureSources(since);
	const messageThreadId = await deps.getOrCreateSystemTopicId();

	const payload = buildSelfAlertPayload({
		failureCount,
		threshold: deps.threshold,
		sourceNames,
		recipient: deps.recipient,
		channelId: deps.channelId,
		messageThreadId,
	});

	if (payload) {
		await deps.channel.send(payload);
	}
}

export interface SelfAlertInput {
	failureCount: number;
	threshold: number;
	sourceNames: string[];
	recipient: string;
	channelId: number;
	messageThreadId: number;
}

export function buildSelfAlertPayload(input: SelfAlertInput): NotificationPayload | null {
	if (input.failureCount <= input.threshold) {
		return null;
	}

	const sourceList = input.sourceNames.length > 0 ? input.sourceNames.join(", ") : "nieznane";

	const body = [
		`⚠️ <b>Alert systemowy: ${input.failureCount} błędów dostarczenia</b>`,
		"",
		`Wykryto <b>${input.failureCount}</b> nieudanych prób dostarczenia w ciągu ostatniej godziny.`,
		`Dotknięte źródła: ${sourceList}`,
	].join("\n");

	return {
		recipient: input.recipient,
		subject: "⚠️ System — błędy dostarczenia",
		body,
		sourceId: 0,
		channelId: input.channelId,
		metadata: { message_thread_id: input.messageThreadId },
	};
}
