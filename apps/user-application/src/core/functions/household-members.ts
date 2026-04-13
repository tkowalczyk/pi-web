import { createServerFn } from "@tanstack/react-start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import { getHousehold } from "@repo/data-ops/queries/household";
import { getHouseholdMembersWithUsers, requireAdmin } from "@repo/data-ops/auth/facade";
import {
	addHouseholdMember,
	removeHouseholdMember,
} from "@repo/data-ops/queries/household-members";
import { getHouseholdRoles } from "@repo/data-ops/queries/household";
import { getUserByEmail } from "@repo/data-ops/queries/user";
import {
	AddMemberByEmailInput,
	RemoveMemberInput,
} from "@repo/data-ops/zod-schema/household-member";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

export const getMyHouseholdMembers = baseFunction.handler(async () => {
	const household = await getHousehold();
	if (!household) {
		throw new Error("No household found");
	}
	return getHouseholdMembersWithUsers(household.id);
});

export const addMyHouseholdMember = baseFunction
	.inputValidator((data) => AddMemberByEmailInput.parse(data))
	.handler(async (ctx) => {
		const household = await getHousehold();
		if (!household) throw new Error("No household found");

		await requireAdmin(ctx.context.userId, household.id);

		const user = await getUserByEmail(ctx.data.email);
		if (!user) throw new Error("User not found with this email");

		return addHouseholdMember({
			householdId: household.id,
			userId: user.id,
			roleId: ctx.data.roleId,
		});
	});

export const removeMyHouseholdMember = baseFunction
	.inputValidator((data) => RemoveMemberInput.parse(data))
	.handler(async (ctx) => {
		const household = await getHousehold();
		if (!household) throw new Error("No household found");

		await requireAdmin(ctx.context.userId, household.id);

		await removeHouseholdMember(ctx.data.memberId);
		return { success: true };
	});

export const getMyHouseholdRoles = baseFunction.handler(async () => {
	return getHouseholdRoles();
});
