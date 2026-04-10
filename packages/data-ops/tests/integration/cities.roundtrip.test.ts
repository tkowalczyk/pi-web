import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDbHandle } from "@repo/test-harness";
import { initDatabase, resetDatabase } from "@/database/setup";
import { cities } from "@/drizzle/schema";
import { getCities } from "@/queries/address";

/**
 * Tracer bullet for M1 Phase 1.
 *
 * Proves the minimum viable integration path end-to-end:
 *   test-harness DB  →  data-ops injected client  →  real query  →  asserts
 *
 * If this test is green, the harness, injection seam, and query layer are
 * wired correctly. Everything else in M1 builds on this path.
 */
describe("cities roundtrip (data-ops ↔ test-harness)", () => {
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

	it("returns rows that were inserted directly into the database", async () => {
		await handle.db.insert(cities).values([{ name: "Kraków" }, { name: "Warszawa" }]);

		const result = await getCities();

		const names = result.map((c) => c.name).sort();
		expect(names).toEqual(["Kraków", "Warszawa"]);
	});
});
