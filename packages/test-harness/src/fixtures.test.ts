import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDbHandle } from "./db";
import {
	createHousehold,
	createHouseholdRole,
	createHouseholdMember,
	createChannel,
	createNotificationSource,
} from "./fixtures";

describe("fixture factories", () => {
	let handle: TestDbHandle;

	beforeAll(async () => {
		handle = await createTestDb();
	});

	afterAll(async () => {
		await handle.cleanup();
	});

	it("creates a household with defaults", async () => {
		const row = await createHousehold(handle.db);
		expect(row.id).toBeTypeOf("number");
		expect(row.name).toBeTypeOf("string");
		expect(row.name.length).toBeGreaterThan(0);
	});

	it("creates a household with overrides", async () => {
		const row = await createHousehold(handle.db, { name: "Kowalski" });
		expect(row.name).toBe("Kowalski");
	});

	it("creates a household role with defaults", async () => {
		const row = await createHouseholdRole(handle.db);
		expect(row.id).toBeTypeOf("number");
		expect(row.name).toBeTypeOf("string");
	});

	it("creates a household member linked to household, user and role", async () => {
		const household = await createHousehold(handle.db);
		const role = await createHouseholdRole(handle.db);
		const member = await createHouseholdMember(handle.db, {
			householdId: household.id,
			roleId: role.id,
		});
		expect(member.id).toBeTypeOf("number");
		expect(member.householdId).toBe(household.id);
		expect(member.roleId).toBe(role.id);
		expect(member.userId).toBeTypeOf("string");
	});

	it("creates a channel linked to household", async () => {
		const household = await createHousehold(handle.db);
		const channel = await createChannel(handle.db, { householdId: household.id });
		expect(channel.id).toBeTypeOf("number");
		expect(channel.householdId).toBe(household.id);
		expect(channel.type).toBeTypeOf("string");
		expect(channel.enabled).toBe(true);
	});

	it("creates a notification source linked to household", async () => {
		const household = await createHousehold(handle.db);
		const source = await createNotificationSource(handle.db, { householdId: household.id });
		expect(source.id).toBeTypeOf("number");
		expect(source.householdId).toBe(household.id);
		expect(source.name).toBeTypeOf("string");
		expect(source.type).toBeTypeOf("string");
		expect(source.enabled).toBe(true);
	});

	it("creates notification source with overrides", async () => {
		const household = await createHousehold(handle.db);
		const source = await createNotificationSource(handle.db, {
			householdId: household.id,
			name: "Waste Collection",
			type: "waste",
			enabled: false,
			config: { schedule: "weekly" },
		});
		expect(source.name).toBe("Waste Collection");
		expect(source.type).toBe("waste");
		expect(source.enabled).toBe(false);
		expect(source.config).toEqual({ schedule: "weekly" });
	});
});
