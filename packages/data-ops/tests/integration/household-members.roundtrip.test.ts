import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDbHandle } from "@repo/test-harness";
import { initDatabase, resetDatabase } from "@/database/setup";
import { auth_user } from "@/drizzle/auth-schema";
import { households, householdRoles } from "@/drizzle/schema";
import {
	addHouseholdMember,
	getHouseholdMembers,
	getMemberByUserId,
	updateMemberRole,
	removeHouseholdMember,
} from "@/queries/household-members";
import { HouseholdMemberResponse } from "@/zod-schema/household-member";

describe("household members CRUD (data-ops ↔ test-harness)", () => {
	let handle: TestDbHandle;
	let householdId: number;
	let adminRoleId: number;
	let memberRoleId: number;
	let testUserId: string;

	beforeEach(async () => {
		handle = await createTestDb();
		resetDatabase();
		initDatabase({ client: handle.db });

		// Get seeded household
		const [h] = await handle.db.select().from(households);
		householdId = h!.id;

		// Get roles
		const roles = await handle.db.select().from(householdRoles);
		adminRoleId = roles.find((r) => r.name === "admin")!.id;
		memberRoleId = roles.find((r) => r.name === "member")!.id;

		// Create test user
		testUserId = "test-user-1";
		await handle.db.insert(auth_user).values({
			id: testUserId,
			name: "Test User",
			email: "test@example.com",
			emailVerified: false,
		});
	});

	afterEach(async () => {
		resetDatabase();
		await handle.cleanup();
	});

	it("adds a member with admin role to the household", async () => {
		const member = await addHouseholdMember({
			householdId,
			userId: testUserId,
			roleId: adminRoleId,
		});

		expect(member).toBeDefined();
		expect(member.householdId).toBe(householdId);
		expect(member.userId).toBe(testUserId);
		expect(member.roleId).toBe(adminRoleId);

		const parsed = HouseholdMemberResponse.parse(member);
		expect(parsed.id).toBe(member.id);
	});

	it("adds a member with member role to the household", async () => {
		const member = await addHouseholdMember({
			householdId,
			userId: testUserId,
			roleId: memberRoleId,
		});

		expect(member.roleId).toBe(memberRoleId);
	});

	it("getHouseholdMembers lists all members for a household", async () => {
		// Add two users
		await addHouseholdMember({ householdId, userId: testUserId, roleId: adminRoleId });

		const secondUserId = "test-user-2";
		await handle.db.insert(auth_user).values({
			id: secondUserId,
			name: "Second User",
			email: "second@example.com",
			emailVerified: false,
		});
		await addHouseholdMember({ householdId, userId: secondUserId, roleId: memberRoleId });

		const members = await getHouseholdMembers(householdId);
		expect(members).toHaveLength(2);
	});

	it("getMemberByUserId returns the correct member", async () => {
		await addHouseholdMember({ householdId, userId: testUserId, roleId: adminRoleId });

		const member = await getMemberByUserId(householdId, testUserId);
		expect(member).toBeDefined();
		expect(member!.userId).toBe(testUserId);
		expect(member!.roleId).toBe(adminRoleId);
	});

	it("getMemberByUserId returns undefined for non-existent user", async () => {
		const member = await getMemberByUserId(householdId, "non-existent");
		expect(member).toBeUndefined();
	});

	it("updateMemberRole changes the role", async () => {
		const member = await addHouseholdMember({
			householdId,
			userId: testUserId,
			roleId: memberRoleId,
		});

		const updated = await updateMemberRole(member.id, adminRoleId);
		expect(updated!.roleId).toBe(adminRoleId);
	});

	it("removeHouseholdMember deletes the member", async () => {
		const member = await addHouseholdMember({
			householdId,
			userId: testUserId,
			roleId: adminRoleId,
		});

		await removeHouseholdMember(member.id);

		const members = await getHouseholdMembers(householdId);
		expect(members).toHaveLength(0);
	});
});
