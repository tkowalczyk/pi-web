import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDbHandle } from "@repo/test-harness";
import { initDatabase, resetDatabase } from "@/database/setup";
import { households } from "@/drizzle/schema";
import {
	createNotificationSource,
	getNotificationSources,
	updateNotificationSource,
	deleteNotificationSource,
} from "@/queries/notification-sources";
import { NotificationSourceResponse } from "@/zod-schema/notification-source";

describe("notification_sources CRUD (data-ops ↔ test-harness)", () => {
	let handle: TestDbHandle;
	let householdId: number;

	beforeEach(async () => {
		handle = await createTestDb();
		resetDatabase();
		initDatabase({ client: handle.db });

		const [h] = await handle.db.select().from(households);
		householdId = h!.id;
	});

	afterEach(async () => {
		resetDatabase();
		await handle.cleanup();
	});

	it("creates a notification source with name, type, and config", async () => {
		const source = await createNotificationSource({
			householdId,
			name: "Wywóz śmieci",
			type: "waste_collection",
			config: { cityId: 1, streetId: 2 },
		});

		expect(source.name).toBe("Wywóz śmieci");
		expect(source.type).toBe("waste_collection");
		expect(source.config).toEqual({ cityId: 1, streetId: 2 });
		expect(source.enabled).toBe(true);

		const parsed = NotificationSourceResponse.parse(source);
		expect(parsed.id).toBe(source.id);
	});

	it("getNotificationSources lists all sources for a household", async () => {
		await createNotificationSource({
			householdId,
			name: "Source 1",
			type: "waste_collection",
			config: {},
		});
		await createNotificationSource({
			householdId,
			name: "Source 2",
			type: "custom",
			config: {},
		});

		const sources = await getNotificationSources(householdId);
		expect(sources).toHaveLength(2);
	});

	it("updateNotificationSource modifies fields", async () => {
		const source = await createNotificationSource({
			householdId,
			name: "Old name",
			type: "waste_collection",
			config: {},
		});

		const updated = await updateNotificationSource(source.id, {
			name: "New name",
			enabled: false,
		});

		expect(updated!.name).toBe("New name");
		expect(updated!.enabled).toBe(false);
	});

	it("deleteNotificationSource removes the source", async () => {
		const source = await createNotificationSource({
			householdId,
			name: "To delete",
			type: "waste_collection",
			config: {},
		});

		await deleteNotificationSource(source.id);

		const sources = await getNotificationSources(householdId);
		expect(sources).toHaveLength(0);
	});
});
