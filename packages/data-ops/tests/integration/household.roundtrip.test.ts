import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDbHandle } from "@repo/test-harness";
import { initDatabase, resetDatabase } from "@/database/setup";
import { households, householdRoles } from "@/drizzle/schema";
import { getHousehold, getHouseholdRoles, updateHousehold } from "@/queries/household";
import { HouseholdResponse } from "@/zod-schema/household";
import { eq } from "drizzle-orm";

describe("household schema + seed (data-ops ↔ test-harness)", () => {
	let handle: TestDbHandle;

	beforeEach(async () => {
		handle = await createTestDb();
		resetDatabase();
		initDatabase({ client: handle.db });
	});

	afterEach(async () => {
		resetDatabase();
		await handle.cleanup();
	});

	it("seeds exactly one household row on fresh database", async () => {
		const rows = await handle.db.select().from(households);
		expect(rows).toHaveLength(1);
		expect(rows[0]!.name).toBe("Dom");
	});

	it("household_roles table contains admin and member roles", async () => {
		const roles = await handle.db.select().from(householdRoles);
		const names = roles.map((r) => r.name).sort();
		expect(names).toEqual(["admin", "member"]);
	});

	it("household has expected columns", async () => {
		const [row] = await handle.db.select().from(households);
		expect(row).toMatchObject({
			id: expect.any(Number),
			name: "Dom",
			createdAt: expect.any(Date),
			updatedAt: expect.any(Date),
		});
	});

	it("household_roles rows have descriptions", async () => {
		const [admin] = await handle.db
			.select()
			.from(householdRoles)
			.where(eq(householdRoles.name, "admin"));
		expect(admin!.description).toBeTruthy();
	});

	it("getHousehold returns the seeded household via typed query", async () => {
		const household = await getHousehold();
		expect(household).toBeDefined();
		expect(household!.name).toBe("Dom");

		// Validate against zod schema
		const parsed = HouseholdResponse.parse(household);
		expect(parsed.id).toBe(household!.id);
	});

	it("getHouseholdRoles returns both roles via typed query", async () => {
		const roles = await getHouseholdRoles();
		expect(roles).toHaveLength(2);
		const names = roles.map((r) => r.name).sort();
		expect(names).toEqual(["admin", "member"]);
	});

	it("getHousehold returns household with timezone", async () => {
		const household = await getHousehold();
		expect(household).toBeDefined();
		expect(household!.timezone).toBe("Europe/Warsaw");

		const parsed = HouseholdResponse.parse(household);
		expect(parsed.timezone).toBe("Europe/Warsaw");
	});

	it("updateHousehold changes timezone", async () => {
		const [h] = await handle.db.select().from(households);
		const updated = await updateHousehold(h!.id, {
			timezone: "America/New_York",
		});

		expect(updated).toBeDefined();
		expect(updated!.timezone).toBe("America/New_York");

		const fetched = await getHousehold();
		expect(fetched!.timezone).toBe("America/New_York");
	});

	it("updateHousehold returns undefined for non-existent household", async () => {
		const result = await updateHousehold(999999, {
			timezone: "UTC",
		});

		expect(result).toBeUndefined();
	});
});
