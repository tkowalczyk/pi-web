import { getDb } from "@/database/setup";
import { auth_user } from "@/drizzle/auth-schema";
import { householdMembers, householdRoles } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

export async function getCurrentUserWithRole(userId: string, householdId: number) {
	const db = getDb();
	const [row] = await db
		.select({
			memberId: householdMembers.id,
			userId: householdMembers.userId,
			householdId: householdMembers.householdId,
			roleId: householdMembers.roleId,
			role: householdRoles.name,
			userName: auth_user.name,
			userEmail: auth_user.email,
		})
		.from(householdMembers)
		.innerJoin(householdRoles, eq(householdMembers.roleId, householdRoles.id))
		.innerJoin(auth_user, eq(householdMembers.userId, auth_user.id))
		.where(and(eq(householdMembers.userId, userId), eq(householdMembers.householdId, householdId)));

	return row;
}

export async function requireAdmin(userId: string, householdId: number) {
	const user = await getCurrentUserWithRole(userId, householdId);
	if (!user || user.role !== "admin") {
		throw new Error("Admin access required");
	}
	return user;
}

export async function getHouseholdMembersWithUsers(householdId: number) {
	const db = getDb();
	return await db
		.select({
			memberId: householdMembers.id,
			userId: householdMembers.userId,
			householdId: householdMembers.householdId,
			roleId: householdMembers.roleId,
			role: householdRoles.name,
			userName: auth_user.name,
			userEmail: auth_user.email,
		})
		.from(householdMembers)
		.innerJoin(householdRoles, eq(householdMembers.roleId, householdRoles.id))
		.innerJoin(auth_user, eq(householdMembers.userId, auth_user.id))
		.where(eq(householdMembers.householdId, householdId));
}
