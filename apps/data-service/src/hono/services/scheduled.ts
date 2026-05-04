import { handleSelfAlert, type SelfAlertDeps } from "@/domain/self-alert";
import { pruneOldLeads } from "@/domain/prune-leads";
import { getOrCreateSystemTopicId, SYSTEM_TOPIC_KV_KEY } from "@/domain/system-topic";
import { TelegramChannel } from "@/channels/telegram";
import { DbDeliveryLogger } from "@/channels/db-delivery-logger";
import { getRecentFailureCount, getRecentFailureSources } from "@repo/data-ops/queries/delivery";
import { deleteLeadsOlderThan } from "@repo/data-ops/queries/leads";

const DEFAULT_FAILURE_THRESHOLD = 5;

export const PRUNE_LEADS_CRON = "0 3 * * *";

export interface ScheduledDeps {
	runPruneLeads(): Promise<void>;
	runSelfAlert(): Promise<void>;
}

export async function dispatchScheduled(cron: string, deps: ScheduledDeps): Promise<void> {
	if (cron === PRUNE_LEADS_CRON) {
		await deps.runPruneLeads();
		return;
	}
	await deps.runSelfAlert();
}

export async function handleScheduled(
	controller: ScheduledController,
	env: Env,
	_ctx: ExecutionContext,
) {
	await dispatchScheduled(controller.cron, {
		runPruneLeads: () => runPruneLeadsJob(),
		runSelfAlert: () => runSelfAlertJob(env),
	});
}

async function runPruneLeadsJob(): Promise<void> {
	const result = await pruneOldLeads({
		now: () => new Date(),
		deleteLeadsOlderThan: (cutoff) => deleteLeadsOlderThan(cutoff),
	});
	console.log(`Cron prune-leads: deleted ${result.deletedCount} lead(s)`);
}

async function runSelfAlertJob(env: Env): Promise<void> {
	const botToken = env.TELEGRAM_BOT_TOKEN;
	const chatId = env.TELEGRAM_GROUP_CHAT_ID;

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
