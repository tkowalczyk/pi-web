import type { NotificationChannel } from "@repo/data-ops/channels/port";
import { renderMessage } from "./lead-handler";

export interface LeadNotifyInput {
	email: string;
	createdAt: Date;
}

export interface LeadNotifyDeps {
	channel: NotificationChannel;
	getOrCreateTopicId(): Promise<number>;
	chatId: string;
}

export async function handleLeadNotify(input: LeadNotifyInput, deps: LeadNotifyDeps) {
	const topicId = await deps.getOrCreateTopicId();
	const body = renderMessage(input.email, input.createdAt);

	return deps.channel.send({
		recipient: deps.chatId,
		subject: "Nowy lead",
		body,
		sourceId: 0,
		channelId: 0,
		metadata: { message_thread_id: topicId },
	});
}
