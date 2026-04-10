import { getDb } from "@/database/setup";
import { households, householdRoles } from "@/drizzle/schema";

export async function getHousehold() {
	const db = getDb();
	const [row] = await db.select().from(households).limit(1);
	return row;
}

export async function getHouseholdRoles() {
	const db = getDb();
	return await db.select().from(householdRoles);
}
