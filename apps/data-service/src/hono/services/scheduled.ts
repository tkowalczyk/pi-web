import { handleSelfAlert, type SelfAlertDeps } from "@/domain/self-alert";
import { getOrCreateSystemTopicId, SYSTEM_TOPIC_KV_KEY } from "@/domain/system-topic";
import { TelegramChannel } from "@/channels/telegram";
import { DbDeliveryLogger } from "@/channels/db-delivery-logger";
import { getRecentFailureCount, getRecentFailureSources } from "@repo/data-ops/queries/delivery";

const DEFAULT_FAILURE_THRESHOLD = 5;

export async function handleScheduled(
	_controller: ScheduledController,
	env: Env,
	_ctx: ExecutionContext,
) {
	const botToken = (env as Record<string, unknown>).TELEGRAM_BOT_TOKEN as string | undefined;
	const chatId = (env as Record<string, unknown>).TELEGRAM_GROUP_CHAT_ID as string | undefined;

	if (!botToken || !chatId) {
		console.log("Cron: TELEGRAM_BOT_TOKEN or TELEGRAM_GROUP_CHAT_ID not set, skipping self-alert.");
		return;
	}

	const channel = new TelegramChannel({
		botToken,
		logger: new DbDeliveryLogger(),
	});

	const deps: SelfAlertDeps = {
		getRecentFailureCount,
		getRecentFailureSources,
		channel,
		threshold: DEFAULT_FAILURE_THRESHOLD,
		recipient: chatId,
		channelId: 0,
		getOrCreateSystemTopicId: () =>
			getOrCreateSystemTopicId({
				getCachedTopicId: async () => {
					const val = await env.CACHE.get(SYSTEM_TOPIC_KV_KEY);
					return val ? Number(val) : null;
				},
				setCachedTopicId: async (id) => {
					await env.CACHE.put(SYSTEM_TOPIC_KV_KEY, String(id));
				},
				createForumTopic: (cId, name) => channel.createForumTopic(cId, name),
				chatId,
			}),
	};

	await handleSelfAlert(deps);
}
