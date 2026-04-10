import { getDb } from "@/database/setup";
import { notificationSources } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import type {
	CreateNotificationSourceInput,
	UpdateNotificationSourceInput,
} from "@/zod-schema/notification-source";

export async function createNotificationSource(input: CreateNotificationSourceInput) {
	const db = getDb();
	const rows = await db.insert(notificationSources).values(input).returning();
	return rows[0] as (typeof rows)[number];
}

export async function getNotificationSourceById(sourceId: number) {
	const db = getDb();
	const [source] = await db
		.select()
		.from(notificationSources)
		.where(eq(notificationSources.id, sourceId));
	return source;
}

export async function getNotificationSources(householdId: number) {
	const db = getDb();
	return await db
		.select()
		.from(notificationSources)
		.where(eq(notificationSources.householdId, householdId));
}

export async function updateNotificationSource(
	sourceId: number,
	input: UpdateNotificationSourceInput,
) {
	const db = getDb();
	const [updated] = await db
		.update(notificationSources)
		.set(input)
		.where(eq(notificationSources.id, sourceId))
		.returning();
	return updated;
}

export async function deleteNotificationSource(sourceId: number) {
	const db = getDb();
	await db.delete(notificationSources).where(eq(notificationSources.id, sourceId));
}
