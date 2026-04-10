import { getDb } from "@/database/setup";
import { householdMembers } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import type { AddMemberInput } from "@/zod-schema/household-member";

export async function addHouseholdMember(input: AddMemberInput) {
	const db = getDb();
	const rows = await db.insert(householdMembers).values(input).returning();
	return rows[0] as (typeof rows)[number];
}

export async function getHouseholdMembers(householdId: number) {
	const db = getDb();
	return await db
		.select()
		.from(householdMembers)
		.where(eq(householdMembers.householdId, householdId));
}

export async function getMemberByUserId(householdId: number, userId: string) {
	const db = getDb();
	const [member] = await db
		.select()
		.from(householdMembers)
		.where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)));
	return member;
}

export async function updateMemberRole(memberId: number, roleId: number) {
	const db = getDb();
	const [updated] = await db
		.update(householdMembers)
		.set({ roleId })
		.where(eq(householdMembers.id, memberId))
		.returning();
	return updated;
}

export async function removeHouseholdMember(memberId: number) {
	const db = getDb();
	await db.delete(householdMembers).where(eq(householdMembers.id, memberId));
}
