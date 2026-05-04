const LEAD_TOPIC_NAME = "📩 Leads";
export const LEAD_TOPIC_KV_KEY = "lead-topic-id";

export interface LeadTopicDeps {
	getCachedTopicId(): Promise<number | null>;
	setCachedTopicId(id: number): Promise<void>;
	createForumTopic(chatId: string, name: string): Promise<number>;
	chatId: string;
}

export async function getOrCreateLeadTopicId(deps: LeadTopicDeps): Promise<number> {
	const cached = await deps.getCachedTopicId();
	if (cached !== null) {
		return cached;
	}

	const topicId = await deps.createForumTopic(deps.chatId, LEAD_TOPIC_NAME);
	await deps.setCachedTopicId(topicId);
	return topicId;
}
