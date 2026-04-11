import { getTopicMetadata } from "./source-topic";

export interface SourceLifecycleDeps {
	insertSource(input: {
		householdId: number;
		name: string;
		type: string;
		config: Record<string, unknown>;
	}): Promise<{ id: number; name: string; type: string }>;
	createForumTopic(chatId: string, name: string, emoji?: string): Promise<number>;
	updateSource(sourceId: number, data: { topicId: number }): Promise<unknown>;
}

export async function createSourceWithTopic(
	input: {
		householdId: number;
		name: string;
		type: string;
		config: Record<string, unknown>;
	},
	chatId: string,
	deps: SourceLifecycleDeps,
) {
	const source = await deps.insertSource(input);

	const meta = getTopicMetadata(source.type, source.name);
	const topicId = await deps.createForumTopic(chatId, meta.name, meta.iconCustomEmojiId);

	await deps.updateSource(source.id, { topicId });

	return { ...source, topicId };
}
