import { createServerFn } from "@tanstack/react-start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import { getHousehold } from "@repo/data-ops/queries/household";
import {
	getNotificationSources,
	getNotificationSourceById,
	updateNotificationSource,
	deleteNotificationSource,
	createNotificationSource,
} from "@repo/data-ops/queries/notification-sources";
import { getLatestDeliveryBySourceIds } from "@repo/data-ops/queries/delivery";
import {
	SourceFormInput,
	getAlertBeforeHoursDefault,
} from "@repo/data-ops/zod-schema/source-form-schema";
import { UpdateNotificationSourceInput } from "@repo/data-ops/zod-schema/notification-source";
import { env } from "cloudflare:workers";
import { z } from "zod";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

export const getMyNotificationSources = baseFunction.handler(async () => {
	const household = await getHousehold();
	if (!household) throw new Error("No household found");

	const sources = await getNotificationSources(household.id);
	const sourceIds = sources.map((s) => s.id);
	const deliveryMap = await getLatestDeliveryBySourceIds(sourceIds);

	return sources.map((source) => ({
		...source,
		config: source.config as Record<string, any>,
		lastDelivery: deliveryMap.get(source.id) ?? null,
	}));
});

export const getNotificationSource = baseFunction
	.inputValidator((data) => z.object({ id: z.number() }).parse(data))
	.handler(async (ctx) => {
		const source = await getNotificationSourceById(ctx.data.id);
		if (!source) return undefined;
		return { ...source, config: source.config as Record<string, any> };
	});

export const createMyNotificationSource = baseFunction
	.inputValidator((data) => SourceFormInput.parse(data))
	.handler(async (ctx) => {
		const household = await getHousehold();
		if (!household) throw new Error("No household found");

		const { name, type, config, alertBeforeHours } = ctx.data;
		const effectiveAlertHours = alertBeforeHours ?? getAlertBeforeHoursDefault(type);

		const source = await createNotificationSource({
			householdId: household.id,
			name,
			type,
			config,
			alertBeforeHours: effectiveAlertHours,
		});

		return { ...source, config: source.config as Record<string, any> };
	});

const UpdateInput = z.object({
	id: z.number(),
	data: UpdateNotificationSourceInput,
});

export const updateMyNotificationSource = baseFunction
	.inputValidator((data) => UpdateInput.parse(data))
	.handler(async (ctx) => {
		const updated = await updateNotificationSource(ctx.data.id, ctx.data.data);
		if (!updated) throw new Error("Source not found");
		return { ...updated, config: updated.config as Record<string, any> };
	});

export const deleteMyNotificationSource = baseFunction
	.inputValidator((data) => z.object({ id: z.number() }).parse(data))
	.handler(async (ctx) => {
		await deleteNotificationSource(ctx.data.id);
		return { success: true };
	});

export const triggerNotificationSource = baseFunction
	.inputValidator((data) => z.object({ id: z.number() }).parse(data))
	.handler(async (ctx) => {
		const response = await env.DATA_SERVICE.fetch(
			new Request(`http://internal/worker/sources/${ctx.data.id}/trigger`, {
				method: "POST",
			}),
		);
		const result = await response.json();
		return result as { success: boolean; error?: string; messageId?: string };
	});
