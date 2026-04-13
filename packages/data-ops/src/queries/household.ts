import { getDb } from "@/database/setup";
import { households, householdRoles } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import type { UpdateHouseholdInput } from "@/zod-schema/household";

export async function getHousehold() {
	const db = getDb();
	const [row] = await db.select().from(households).limit(1);
	return row;
}

export async function getHouseholdRoles() {
	const db = getDb();
	return await db.select().from(householdRoles);
}

export async function updateHousehold(householdId: number, input: UpdateHouseholdInput) {
	const db = getDb();
	const [updated] = await db
		.update(households)
		.set(input)
		.where(eq(households.id, householdId))
		.returning();
	return updated;
}
