const SYSTEM_TOPIC_NAME = "⚠️ System";
export const SYSTEM_TOPIC_KV_KEY = "system-alert-topic-id";

export interface SystemTopicDeps {
	getCachedTopicId(): Promise<number | null>;
	setCachedTopicId(id: number): Promise<void>;
	createForumTopic(chatId: string, name: string): Promise<number>;
	chatId: string;
}

export async function getOrCreateSystemTopicId(deps: SystemTopicDeps): Promise<number> {
	const cached = await deps.getCachedTopicId();
	if (cached !== null) {
		return cached;
	}

	const topicId = await deps.createForumTopic(deps.chatId, SYSTEM_TOPIC_NAME);
	await deps.setCachedTopicId(topicId);
	return topicId;
}
