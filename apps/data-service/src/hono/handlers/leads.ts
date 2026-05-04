import { Hono } from "hono";
import { NotifyLeadInput } from "@repo/data-ops/zod-schema/lead";
import { TelegramChannel } from "@/channels/telegram";
import { handleLeadNotify } from "@/domain/lead-notify";
import { getOrCreateLeadTopicId, LEAD_TOPIC_KV_KEY } from "@/domain/lead-topic";

export const leadsApp = new Hono<{ Bindings: Env }>();

leadsApp.post("/notify", async (c) => {
	const botToken = c.env?.TELEGRAM_BOT_TOKEN;
	const chatId = c.env?.TELEGRAM_GROUP_CHAT_ID;

	if (!botToken || !chatId) {
		return c.json({ success: false, error: "Telegram not configured" }, 503);
	}

	const body = await c.req.json();
	const parsed = NotifyLeadInput.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
	}

	const channel = new TelegramChannel({ botToken, fetchFn: fetch.bind(globalThis) });

	const result = await handleLeadNotify(
		{ email: parsed.data.email, createdAt: parsed.data.createdAt },
		{
			channel,
			chatId,
			getOrCreateTopicId: () =>
				getOrCreateLeadTopicId({
					getCachedTopicId: async () => {
						const val = await c.env.CACHE.get(LEAD_TOPIC_KV_KEY);
						return val ? Number(val) : null;
					},
					setCachedTopicId: async (id) => {
						await c.env.CACHE.put(LEAD_TOPIC_KV_KEY, String(id));
					},
					createForumTopic: (cId, name) => channel.createForumTopic(cId, name),
					chatId,
				}),
		},
	);

	return c.json(result, result.success ? 200 : 500);
});
