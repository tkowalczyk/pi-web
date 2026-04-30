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
import { z } from "zod";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

interface SchedulerStateLite {
	nextAlarmAt: string | null;
	lastRunAt: string | null;
	lastRunSuccess: boolean | null;
	status: "idle" | "scheduled";
}

async function fetchSchedulerState(
	dataService: { fetch: (req: Request) => Promise<Response> },
	sourceId: number,
): Promise<SchedulerStateLite | null> {
	try {
		const response = await dataService.fetch(
			new Request(`https://internal/worker/sources/${sourceId}/state`, {
				method: "GET",
			}),
		);
		if (!response.ok) return null;
		const body = (await response.json()) as SchedulerStateLite;
		return body;
	} catch {
		return null;
	}
}

export const getMyNotificationSources = baseFunction.handler(async (ctx) => {
	const household = await getHousehold();
	if (!household) throw new Error("No household found");

	const sources = await getNotificationSources(household.id);
	const sourceIds = sources.map((s) => s.id);
	const deliveryMap = await getLatestDeliveryBySourceIds(sourceIds);

	const dataService = ctx.context.dataService;
	const stateMap = new Map<number, SchedulerStateLite | null>();
	if (dataService) {
		const states = await Promise.all(sourceIds.map((id) => fetchSchedulerState(dataService, id)));
		sourceIds.forEach((id, i) => {
			stateMap.set(id, states[i] ?? null);
		});
	}

	return sources.map((source) => ({
		...source,
		config: source.config as Record<string, any>,
		lastDelivery: deliveryMap.get(source.id) ?? null,
		schedulerState: stateMap.get(source.id) ?? null,
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

		const dataService = ctx.context.dataService;
		if (dataService) {
			const response = await dataService.fetch(
				new Request("https://internal/worker/sources", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						householdId: household.id,
						name,
						type,
						config,
						alertBeforeHours: effectiveAlertHours,
					}),
				}),
			);
			const source = (await response.json()) as Record<string, any>;

			// Best-effort: schedule the SchedulerDO right after creation so the
			// alarm fires without waiting for a separate Edit→Save round-trip.
			if (typeof source?.id === "number") {
				try {
					await dataService.fetch(
						new Request(`https://internal/worker/sources/${source.id}/reschedule`, {
							method: "POST",
						}),
					);
				} catch (e) {
					console.warn(`reschedule failed for new source ${source.id}:`, e);
				}
			}

			return source;
		}

		// Fallback: no data-service binding — insert directly (no topic created)
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

		const dataService = ctx.context.dataService;
		if (dataService) {
			// Best-effort: refresh SchedulerDO so config/alertBeforeHours changes
			// take effect on the next alarm. DB write is the source of truth and
			// must not be rolled back if reschedule fails.
			try {
				await dataService.fetch(
					new Request(`https://internal/worker/sources/${ctx.data.id}/reschedule`, {
						method: "POST",
					}),
				);
			} catch (e) {
				console.warn(`reschedule failed for source ${ctx.data.id}:`, e);
			}
		}

		return { ...updated, config: updated.config as Record<string, any> };
	});

export const deleteMyNotificationSource = baseFunction
	.inputValidator((data) => z.object({ id: z.number() }).parse(data))
	.handler(async (ctx) => {
		const dataService = ctx.context.dataService;
		if (dataService) {
			await dataService.fetch(
				new Request(`https://internal/worker/sources/${ctx.data.id}`, {
					method: "DELETE",
				}),
			);
			return { success: true };
		}

		// Fallback: no data-service binding — delete directly (no topic cleanup)
		await deleteNotificationSource(ctx.data.id);
		return { success: true };
	});

export const triggerNotificationSource = baseFunction
	.inputValidator((data) => z.object({ id: z.number() }).parse(data))
	.handler(async (ctx) => {
		const dataService = ctx.context.dataService;
		if (!dataService) throw new Error("DATA_SERVICE binding not available");
		const response = await dataService.fetch(
			new Request(`https://internal/worker/sources/${ctx.data.id}/trigger`, {
				method: "POST",
			}),
		);
		const result = await response.json();
		return result as { success: boolean; error?: string; messageId?: string };
	});
