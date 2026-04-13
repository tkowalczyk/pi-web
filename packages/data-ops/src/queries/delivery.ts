import { getDb } from "@/database/setup";
import { deliveryLog, deliveryFailures } from "@/drizzle/schema";
import { eq, desc, inArray, sql } from "drizzle-orm";
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

export async function getLatestDeliveryBySourceIds(
	sourceIds: number[],
): Promise<Map<number, { status: string; error: string | null; createdAt: Date }>> {
	if (sourceIds.length === 0) return new Map();

	const db = getDb();

	const latestPerSource = db
		.select({
			sourceId: deliveryLog.sourceId,
			maxId: sql<number>`max(${deliveryLog.id})`.as("max_id"),
		})
		.from(deliveryLog)
		.where(inArray(deliveryLog.sourceId, sourceIds))
		.groupBy(deliveryLog.sourceId)
		.as("latest");

	const rows = await db
		.select({
			sourceId: deliveryLog.sourceId,
			status: deliveryLog.status,
			error: deliveryLog.error,
			createdAt: deliveryLog.createdAt,
		})
		.from(deliveryLog)
		.innerJoin(latestPerSource, sql`${deliveryLog.id} = ${latestPerSource.maxId}`);

	const map = new Map<number, { status: string; error: string | null; createdAt: Date }>();
	for (const row of rows) {
		map.set(row.sourceId, { status: row.status, error: row.error, createdAt: row.createdAt });
	}
	return map;
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
