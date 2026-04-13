import { getDb } from "@/database/setup";
import { deliveryLog, deliveryFailures, notificationSources } from "@/drizzle/schema";
import { eq, desc, inArray, sql, gte, and, count } from "drizzle-orm";
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

export async function getRecentFailureCount(since: Date): Promise<number> {
	const db = getDb();
	const [row] = await db
		.select({ count: count() })
		.from(deliveryFailures)
		.where(gte(deliveryFailures.createdAt, since));
	return row?.count ?? 0;
}

export async function getRecentFailureSources(since: Date): Promise<string[]> {
	const db = getDb();
	const rows = await db
		.selectDistinct({ name: notificationSources.name })
		.from(deliveryFailures)
		.innerJoin(
			notificationSources,
			eq(deliveryFailures.sourceId, notificationSources.id),
		)
		.where(gte(deliveryFailures.createdAt, since));
	return rows.map((r) => r.name);
}

export async function getDeliveryLogFiltered(opts: {
	sourceId?: number;
	status?: string;
	limit?: number;
}) {
	const db = getDb();
	const conditions = [];
	if (opts.sourceId) {
		conditions.push(eq(deliveryLog.sourceId, opts.sourceId));
	}
	if (opts.status) {
		conditions.push(eq(deliveryLog.status, opts.status));
	}

	return await db
		.select({
			id: deliveryLog.id,
			sourceId: deliveryLog.sourceId,
			sourceName: notificationSources.name,
			channel: deliveryLog.channel,
			status: deliveryLog.status,
			error: deliveryLog.error,
			retryCount: deliveryLog.retryCount,
			createdAt: deliveryLog.createdAt,
		})
		.from(deliveryLog)
		.innerJoin(
			notificationSources,
			eq(deliveryLog.sourceId, notificationSources.id),
		)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(deliveryLog.createdAt))
		.limit(opts.limit ?? 100);
}
