import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDbHandle } from "@repo/test-harness";
import { initDatabase, resetDatabase } from "@/database/setup";
import { auth_user } from "@/drizzle/auth-schema";
import { households, householdRoles, householdMembers } from "@/drizzle/schema";
import { getCurrentUserWithRole, requireAdmin, getHouseholdMembersWithUsers } from "@/auth/facade";
import { eq } from "drizzle-orm";

describe("auth facade (data-ops ↔ test-harness)", () => {
	let handle: TestDbHandle;
	let householdId: number;
	let adminRoleId: number;
	let memberRoleId: number;

	const adminUserId = "admin-user-1";
	const memberUserId = "member-user-1";

	beforeEach(async () => {
		handle = await createTestDb();
		resetDatabase();
		initDatabase({ client: handle.db });

		// Get seeded data
		const [h] = await handle.db.select().from(households);
		householdId = h!.id;

		const roles = await handle.db.select().from(householdRoles);
		adminRoleId = roles.find((r) => r.name === "admin")!.id;
		memberRoleId = roles.find((r) => r.name === "member")!.id;

		// Create test users
		await handle.db.insert(auth_user).values([
			{ id: adminUserId, name: "Admin User", email: "admin@example.com", emailVerified: true },
			{ id: memberUserId, name: "Member User", email: "member@example.com", emailVerified: true },
		]);

		// Add members
		await handle.db.insert(householdMembers).values([
			{ householdId, userId: adminUserId, roleId: adminRoleId },
			{ householdId, userId: memberUserId, roleId: memberRoleId },
		]);
	});

	afterEach(async () => {
		resetDatabase();
		await handle.cleanup();
	});

	it("getCurrentUserWithRole returns user with admin role", async () => {
		const result = await getCurrentUserWithRole(adminUserId, householdId);
		expect(result).toBeDefined();
		expect(result!.userId).toBe(adminUserId);
		expect(result!.role).toBe("admin");
		expect(result!.userName).toBe("Admin User");
	});

	it("getCurrentUserWithRole returns user with member role", async () => {
		const result = await getCurrentUserWithRole(memberUserId, householdId);
		expect(result!.role).toBe("member");
	});

	it("getCurrentUserWithRole returns undefined for non-member", async () => {
		const result = await getCurrentUserWithRole("unknown-user", householdId);
		expect(result).toBeUndefined();
	});

	it("requireAdmin does not throw for admin", async () => {
		await expect(requireAdmin(adminUserId, householdId)).resolves.not.toThrow();
	});

	it("requireAdmin throws for member role", async () => {
		await expect(requireAdmin(memberUserId, householdId)).rejects.toThrow("Admin access required");
	});

	it("requireAdmin throws for non-member", async () => {
		await expect(requireAdmin("unknown-user", householdId)).rejects.toThrow(
			"Admin access required",
		);
	});

	it("getHouseholdMembersWithUsers returns members with user info", async () => {
		const members = await getHouseholdMembersWithUsers(householdId);
		expect(members).toHaveLength(2);

		const admin = members.find((m) => m.userId === adminUserId);
		expect(admin).toBeDefined();
		expect(admin!.userName).toBe("Admin User");
		expect(admin!.userEmail).toBe("admin@example.com");
		expect(admin!.role).toBe("admin");
	});
});
