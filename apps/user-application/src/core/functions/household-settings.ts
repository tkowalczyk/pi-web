import { createServerFn } from "@tanstack/react-start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import { getHousehold, updateHousehold } from "@repo/data-ops/queries/household";
import { requireAdmin } from "@repo/data-ops/auth/facade";
import { getActiveSourcesByHousehold } from "@repo/data-ops/queries/notification-sources";
import { UpdateHouseholdInput } from "@repo/data-ops/zod-schema/household";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

export const getMyHouseholdSettings = baseFunction.handler(async () => {
	const household = await getHousehold();
	if (!household) throw new Error("No household found");

	return {
		id: household.id,
		name: household.name,
		timezone: household.timezone,
	};
});

export const updateMyHouseholdTimezone = baseFunction
	.inputValidator((data) => UpdateHouseholdInput.parse(data))
	.handler(async (ctx) => {
		const household = await getHousehold();
		if (!household) throw new Error("No household found");

		await requireAdmin(ctx.context.userId, household.id);

		const updated = await updateHousehold(household.id, {
			timezone: ctx.data.timezone,
		});
		if (!updated) throw new Error("Failed to update household");

		// Get active sources that need rescheduling
		const activeSources = await getActiveSourcesByHousehold(household.id);

		// TODO: Call SchedulerDO.updateSchedule() for each active source
		// This requires service binding to data-service worker.
		// For now, return the count so UI can display it.

		return {
			timezone: updated.timezone,
			rescheduledCount: activeSources.length,
		};
	});
