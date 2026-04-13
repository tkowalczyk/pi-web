import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createTestDb,
	createHousehold,
	createNotificationSource,
	type TestDbHandle,
} from "@repo/test-harness";
import { initDatabase, resetDatabase } from "@/database/setup";
import {
	insertDeliveryLog,
	getDeliveryLogs,
	getLatestDeliveryBySourceIds,
	insertDeliveryFailure,
	getDeliveryFailures,
} from "@/queries/delivery";

describe("delivery log + failures CRUD (data-ops ↔ test-harness)", () => {
	let handle: TestDbHandle;
	let sourceId: number;

	beforeEach(async () => {
		handle = await createTestDb();
		resetDatabase();
		initDatabase({ client: handle.db });

		const household = await createHousehold(handle.db);
		const source = await createNotificationSource(handle.db, {
			householdId: household.id,
			type: "waste_collection",
		});
		sourceId = source.id;
	});

	afterEach(async () => {
		resetDatabase();
		await handle.cleanup();
	});

	it("inserts a delivery log entry and retrieves it", async () => {
		const row = await insertDeliveryLog({
			sourceId,
			channel: "telegram",
			status: "success",
			retryCount: 0,
		});

		expect(row.id).toBeTypeOf("number");
		expect(row.sourceId).toBe(sourceId);
		expect(row.channel).toBe("telegram");
		expect(row.status).toBe("success");
		expect(row.retryCount).toBe(0);
		expect(row.error).toBeNull();
		expect(row.createdAt).toBeInstanceOf(Date);
	});

	it("inserts a delivery log entry with error", async () => {
		const row = await insertDeliveryLog({
			sourceId,
			channel: "telegram",
			status: "failure",
			error: "HTTP 429",
			retryCount: 3,
		});

		expect(row.status).toBe("failure");
		expect(row.error).toBe("HTTP 429");
		expect(row.retryCount).toBe(3);
	});

	it("getDeliveryLogs returns logs for a source", async () => {
		await insertDeliveryLog({ sourceId, channel: "telegram", status: "success", retryCount: 0 });
		await insertDeliveryLog({
			sourceId,
			channel: "telegram",
			status: "failure",
			error: "err",
			retryCount: 1,
		});

		const logs = await getDeliveryLogs(sourceId);
		expect(logs).toHaveLength(2);
	});

	it("inserts a delivery failure and retrieves it", async () => {
		const row = await insertDeliveryFailure({
			sourceId,
			channel: "telegram",
			error: "HTTP 429: rate limited",
			retryCount: 3,
			payload: { recipient: "-100123", body: "test" },
		});

		expect(row.id).toBeTypeOf("number");
		expect(row.sourceId).toBe(sourceId);
		expect(row.channel).toBe("telegram");
		expect(row.error).toBe("HTTP 429: rate limited");
		expect(row.retryCount).toBe(3);
		expect(row.payload).toEqual({ recipient: "-100123", body: "test" });
	});

	it("getLatestDeliveryBySourceIds returns most recent log per source", async () => {
		await insertDeliveryLog({ sourceId, channel: "telegram", status: "success", retryCount: 0 });
		await insertDeliveryLog({
			sourceId,
			channel: "telegram",
			status: "failure",
			error: "err",
			retryCount: 1,
		});

		const map = await getLatestDeliveryBySourceIds([sourceId]);
		expect(map.has(sourceId)).toBe(true);

		const latest = map.get(sourceId)!;
		expect(latest.status).toBe("failure");
		expect(latest.error).toBe("err");
	});

	it("getLatestDeliveryBySourceIds returns empty map for no sources", async () => {
		const map = await getLatestDeliveryBySourceIds([]);
		expect(map.size).toBe(0);
	});

	it("getDeliveryFailures returns failures for a source", async () => {
		await insertDeliveryFailure({
			sourceId,
			channel: "telegram",
			error: "err1",
			retryCount: 3,
			payload: {},
		});
		await insertDeliveryFailure({
			sourceId,
			channel: "telegram",
			error: "err2",
			retryCount: 3,
			payload: {},
		});

		const failures = await getDeliveryFailures(sourceId);
		expect(failures).toHaveLength(2);
	});
});
