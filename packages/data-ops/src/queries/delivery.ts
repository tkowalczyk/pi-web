import { getDb } from "@/database/setup";
import { deliveryLog, deliveryFailures } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { InsertDeliveryLog, InsertDeliveryFailure } from "@/zod-schema/delivery";

export async function insertDeliveryLog(input: InsertDeliveryLog) {
	const db = getDb();
	const [row] = await db.insert(deliveryLog).values(input).returning();
	return row!;
}

export async function getDeliveryLogs(sourceId: number) {
	const db = getDb();
	return await db
		.select()
		.from(deliveryLog)
		.where(eq(deliveryLog.sourceId, sourceId))
		.orderBy(desc(deliveryLog.createdAt));
}

export async function insertDeliveryFailure(input: InsertDeliveryFailure) {
	const db = getDb();
	const [row] = await db.insert(deliveryFailures).values(input).returning();
	return row!;
}

export async function getDeliveryFailures(sourceId: number) {
	const db = getDb();
	return await db
		.select()
		.from(deliveryFailures)
		.where(eq(deliveryFailures.sourceId, sourceId))
		.orderBy(desc(deliveryFailures.createdAt));
}
