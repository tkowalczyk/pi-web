import { createServerFn } from "@tanstack/react-start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import { getHousehold } from "@repo/data-ops/queries/household";
import { getHouseholdMembersWithUsers } from "@repo/data-ops/auth/facade";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

export const getMyHouseholdMembers = baseFunction.handler(async () => {
	const household = await getHousehold();
	if (!household) {
		throw new Error("No household found");
	}
	return getHouseholdMembersWithUsers(household.id);
});
