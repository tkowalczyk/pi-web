import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createTestDb,
	createHousehold,
	createNotificationSource,
	type TestDbHandle,
} from "@repo/test-harness";
import { initDatabase, resetDatabase } from "@repo/data-ops/database/setup";
import { getDeliveryLogs, getDeliveryFailures } from "@repo/data-ops/queries/delivery";
import { DbDeliveryLogger } from "./db-delivery-logger";

describe("DbDeliveryLogger", () => {
	let handle: TestDbHandle;
	let sourceId: number;
	let logger: DbDeliveryLogger;

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
		logger = new DbDeliveryLogger();
	});

	afterEach(async () => {
		resetDatabase();
		await handle.cleanup();
	});

	it("logDelivery writes a row to delivery_log", async () => {
		logger.logDelivery({
			sourceId,
			channel: "telegram",
			status: "success",
			retryCount: 0,
		});

		// Wait for fire-and-forget promise
		await new Promise((r) => setTimeout(r, 50));

		const logs = await getDeliveryLogs(sourceId);
		expect(logs).toHaveLength(1);
		expect(logs[0]?.status).toBe("success");
		expect(logs[0]?.channel).toBe("telegram");
	});

	it("logFailure writes a row to delivery_failures", async () => {
		logger.logFailure({
			sourceId,
			channel: "telegram",
			error: "HTTP 429",
			retryCount: 3,
			payload: { recipient: "-100", body: "test" },
		});

		await new Promise((r) => setTimeout(r, 50));

		const failures = await getDeliveryFailures(sourceId);
		expect(failures).toHaveLength(1);
		expect(failures[0]?.error).toBe("HTTP 429");
		expect(failures[0]?.retryCount).toBe(3);
		expect(failures[0]?.payload).toEqual({ recipient: "-100", body: "test" });
	});
});
