import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDbHandle } from "@repo/test-harness";
import { initDatabase, resetDatabase } from "@/database/setup";
import { emailWhitelist } from "@/drizzle/schema";
import { isEmailWhitelisted, listEmailWhitelist } from "@/queries/email-whitelist";

describe("email_whitelist (data-ops)", () => {
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

	it("returns false when email is not on the whitelist", async () => {
		expect(await isEmailWhitelisted("nope@example.com")).toBe(false);
	});

	it("returns true when email is on the whitelist", async () => {
		await handle.db.insert(emailWhitelist).values({ email: "ok@example.com" });
		expect(await isEmailWhitelisted("ok@example.com")).toBe(true);
	});

	it("matches case-insensitively and trims whitespace", async () => {
		await handle.db.insert(emailWhitelist).values({ email: "case@example.com" });
		expect(await isEmailWhitelisted("CASE@example.com")).toBe(true);
		expect(await isEmailWhitelisted("  case@example.com  ")).toBe(true);
	});

	it("listEmailWhitelist returns all rows ordered by email", async () => {
		await handle.db
			.insert(emailWhitelist)
			.values([{ email: "b@example.com" }, { email: "a@example.com", note: "first" }]);
		const rows = await listEmailWhitelist();
		expect(rows.map((r) => r.email)).toEqual(["a@example.com", "b@example.com"]);
		expect(rows[0]!.note).toBe("first");
	});
});
