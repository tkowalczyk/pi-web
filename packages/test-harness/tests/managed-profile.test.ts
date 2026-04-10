import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb, type TestDbHandle } from "../src";

/**
 * Second tracer bullet for M1 Phase 1 (follow-up issue #13).
 *
 * Proves that the `managed` profile in test-harness can:
 *   1. Connect to a real Neon Postgres database via TEST_DATABASE_URL
 *   2. Apply the data-ops dev migration set so schema is real-shape
 *   3. Run a write+read roundtrip end-to-end
 *
 * The whole suite is conditional: when TEST_DATABASE_URL is unset (typical
 * local dev workflow), the suite is skipped — local devs run the PGLite
 * profile via `pnpm test`. When the env var is set (CI with an ephemeral
 * Neon branch, or a developer who wants fidelity locally), it runs.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.runIf(TEST_DATABASE_URL)("test-harness managed profile (Neon)", () => {
	let handle: TestDbHandle;

	beforeEach(() => {
		vi.stubEnv("TEST_DB_PROFILE", "managed");
	});

	afterEach(async () => {
		if (handle) await handle.cleanup();
		vi.unstubAllEnvs();
	});

	it("returns a working drizzle handle backed by a real Postgres connection", async () => {
		handle = await createTestDb();
		expect(handle.db).toBeDefined();

		// Sanity-check the underlying connection: a roundtrip SELECT 1.
		const result = await handle.db.execute(sql`select 1 as one`);
		// drizzle's neon-http result shape exposes rows under .rows
		const rows = (result as { rows?: Array<Record<string, unknown>> }).rows ?? result;
		expect(Array.isArray(rows) ? rows.length : 0).toBeGreaterThan(0);
	});

	it("has the data-ops schema applied so cities table is queryable", async () => {
		handle = await createTestDb();

		// We don't depend on @repo/data-ops here (test-harness sits below it
		// in the dependency graph), so we use raw SQL via drizzle's `sql`
		// helper to confirm the table exists and accepts a roundtrip.
		const insertResult = await handle.db.execute(
			sql`insert into cities (name) values (${"Test City"}) returning id, name`,
		);
		const insertedRows =
			(insertResult as { rows?: Array<{ id: number; name: string }> }).rows ??
			(insertResult as unknown as Array<{ id: number; name: string }>);
		const inserted = Array.isArray(insertedRows) ? insertedRows[0] : undefined;
		expect(inserted?.name).toBe("Test City");

		const selectResult = await handle.db.execute(
			sql`select name from cities where id = ${inserted?.id}`,
		);
		const selectedRows =
			(selectResult as { rows?: Array<{ name: string }> }).rows ??
			(selectResult as unknown as Array<{ name: string }>);
		const selected = Array.isArray(selectedRows) ? selectedRows[0] : undefined;
		expect(selected?.name).toBe("Test City");

		// Clean up the row so re-runs against the same branch don't accumulate.
		await handle.db.execute(sql`delete from cities where id = ${inserted?.id}`);
	});
});

/**
 * A complementary check that runs unconditionally: when TEST_DATABASE_URL
 * is *unset* but the user still asks for the managed profile, we get a
 * descriptive error rather than a confusing connection failure.
 */
describe("test-harness managed profile (Neon) - misconfiguration", () => {
	beforeEach(() => {
		vi.stubEnv("TEST_DB_PROFILE", "managed");
		vi.stubEnv("TEST_DATABASE_URL", "");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("throws a descriptive error when TEST_DATABASE_URL is missing", async () => {
		await expect(createTestDb()).rejects.toThrow(/TEST_DATABASE_URL/);
	});
});
