import { Hono } from "hono";
import {
	createNotificationSource,
	updateNotificationSource,
	deleteNotificationSource,
} from "@repo/data-ops/queries/notification-sources";
import { SourceFormInput } from "@repo/data-ops/zod-schema/source-form-schema";
import { UpdateNotificationSourceInput } from "@repo/data-ops/zod-schema/notification-source";
import { createSourceWithTopic, type SourceLifecycleDeps } from "@/domain/source-lifecycle";
import { TelegramChannel } from "@/channels/telegram";

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
		const channel = new TelegramChannel({ botToken });
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
	await deleteNotificationSource(id);
	return c.body(null, 204);
});
