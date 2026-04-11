export interface TopicMetadata {
	name: string;
	iconCustomEmojiId?: string;
}

const SOURCE_TYPE_EMOJI: Record<string, string> = {
	waste_collection: "🗑",
	birthday: "🎂",
};

export function getTopicMetadata(sourceType: string, sourceName: string): TopicMetadata {
	const emoji = SOURCE_TYPE_EMOJI[sourceType];
	return {
		name: sourceName,
		iconCustomEmojiId: emoji,
	};
}
