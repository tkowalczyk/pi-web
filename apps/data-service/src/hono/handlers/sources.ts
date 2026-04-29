import { Hono } from "hono";
import {
	createNotificationSource,
	updateNotificationSource,
	deleteNotificationSource,
	getNotificationSourceById,
} from "@repo/data-ops/queries/notification-sources";
import { getHousehold } from "@repo/data-ops/queries/household";
import { SourceFormInput } from "@repo/data-ops/zod-schema/source-form-schema";
import { UpdateNotificationSourceInput } from "@repo/data-ops/zod-schema/notification-source";
import { createSourceWithTopic, type SourceLifecycleDeps } from "@/domain/source-lifecycle";
import { TelegramChannel } from "@/channels/telegram";
import { renderSourceToPayload } from "@/domain/notification";
import { getTopicMetadata } from "@/domain/source-topic";

const DEFAULT_ALERT_BEFORE_HOURS: Record<string, number> = {
	waste_collection: 6,
	birthday: 24,
};

export const sourcesApp = new Hono<{ Bindings: Env }>();

sourcesApp.post("/", async (c) => {
	const body = await c.req.json();
	const parsed = SourceFormInput.safeParse(body);

	if (!parsed.success) {
		return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
	}

	const { name, type, config, alertBeforeHours } = parsed.data;
	const householdId = body.householdId as number;

	const chatId = c.env?.TELEGRAM_GROUP_CHAT_ID;
	const botToken = c.env?.TELEGRAM_BOT_TOKEN;

	if (chatId && botToken) {
		const channel = new TelegramChannel({ botToken, fetchFn: fetch.bind(globalThis) });
		const deps: SourceLifecycleDeps = {
			insertSource: (input) => createNotificationSource({ ...input, alertBeforeHours }),
			createForumTopic: (cId, n, emoji) => channel.createForumTopic(cId, n, emoji),
			updateSource: (sourceId, data) => updateNotificationSource(sourceId, data),
		};

		const result = await createSourceWithTopic({ householdId, name, type, config }, chatId, deps);
		return c.json(result, 201);
	}

	// Fallback: no Telegram config — just insert source
	const source = await createNotificationSource({
		householdId,
		name,
		type,
		config,
		alertBeforeHours,
	});
	return c.json(source, 201);
});

sourcesApp.put("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const body = await c.req.json();
	const parsed = UpdateNotificationSourceInput.safeParse(body);

	if (!parsed.success) {
		return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
	}

	const updated = await updateNotificationSource(id, parsed.data);
	return c.json(updated);
});

sourcesApp.delete("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const source = await getNotificationSourceById(id);
	if (!source) {
		return c.json({ error: "Source not found" }, 404);
	}

	const botToken = c.env?.TELEGRAM_BOT_TOKEN;
	const chatId = c.env?.TELEGRAM_GROUP_CHAT_ID;
	if (botToken && chatId && source.topicId) {
		const channel = new TelegramChannel({ botToken, fetchFn: fetch.bind(globalThis) });
		await channel.deleteForumTopic(chatId, source.topicId);
	}

	await deleteNotificationSource(id);
	return c.body(null, 204);
});

sourcesApp.get("/:id/state", async (c) => {
	const id = Number(c.req.param("id"));
	const stub = c.env.SCHEDULER.get(c.env.SCHEDULER.idFromName(`source-${id}`));
	const state = await stub.getState();
	return c.json(state);
});

sourcesApp.post("/:id/reschedule", async (c) => {
	const id = Number(c.req.param("id"));
	const source = await getNotificationSourceById(id);
	if (!source) {
		return c.json({ error: "Source not found" }, 404);
	}

	const household = await getHousehold();
	if (!household) {
		return c.json({ error: "Household not found" }, 404);
	}

	const chatId = c.env?.TELEGRAM_GROUP_CHAT_ID;
	const alertBeforeHours = source.alertBeforeHours ?? DEFAULT_ALERT_BEFORE_HOURS[source.type] ?? 24;

	const stub = c.env.SCHEDULER.get(c.env.SCHEDULER.idFromName(`source-${id}`));
	const state = await stub.scheduleFromSource(
		{
			id: source.id,
			name: source.name,
			type: source.type,
			config: source.config as Record<string, unknown>,
		},
		alertBeforeHours,
		household.timezone,
		{ channelId: 0, recipient: chatId ?? "", topicId: source.topicId ?? null },
	);

	return c.json({
		sourceId: state.sourceId,
		nextAlarmAt: state.nextAlarmAt,
		status: state.status,
	});
});

sourcesApp.post("/:id/trigger", async (c) => {
	const id = Number(c.req.param("id"));
	const botToken = c.env?.TELEGRAM_BOT_TOKEN;
	const chatId = c.env?.TELEGRAM_GROUP_CHAT_ID;

	if (!botToken || !chatId) {
		return c.json({ success: false, error: "Telegram not configured" }, 500);
	}

	const source = await getNotificationSourceById(id);
	if (!source) {
		return c.json({ success: false, error: "Source not found" }, 404);
	}

	// For test triggers, find the nearest future date with scheduled waste
	let scheduledDate = new Date().toISOString().slice(0, 10);
	const config = source.config as Record<string, unknown>;
	if (source.type === "waste_collection" && Array.isArray(config.schedule)) {
		const today = scheduledDate;
		const futureDates = (config.schedule as Array<{ dates: string[] }>)
			.flatMap((e) => e.dates)
			.filter((d) => d >= today)
			.sort();
		if (futureDates.length > 0) {
			scheduledDate = futureDates[0]!;
		}
	}

	const payload = renderSourceToPayload(
		{
			id: source.id,
			name: source.name,
			type: source.type,
			config,
		},
		{
			channelId: 0,
			recipient: chatId,
			scheduledDate,
			notificationType: "day_before",
		},
	);

	const channel = new TelegramChannel({ botToken, fetchFn: fetch.bind(globalThis) });

	// Auto-create topic if missing (backfill for sources created before topic support)
	let topicId = source.topicId;
	if (!topicId) {
		const meta = getTopicMetadata(source.type, source.name);
		topicId = await channel.createForumTopic(chatId, meta.name, meta.iconCustomEmojiId);
		await updateNotificationSource(source.id, { topicId });
	}

	payload.metadata = { message_thread_id: topicId };

	const result = await channel.send(payload);
	return c.json(result, result.success ? 200 : 500);
});
