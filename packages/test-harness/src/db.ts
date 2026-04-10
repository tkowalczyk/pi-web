import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { neon } from "@neondatabase/serverless";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";

/**
 * A minimal, structurally-compatible Drizzle PG client used by tests.
 * Intentionally typed as `PgDatabase<any>` so both the PGLite-backed local
 * profile and the Neon-backed managed profile fit the same slot.
 */
export type TestDb = PgDatabase<any, any, any>;

export interface TestDbHandle {
	db: TestDb;
	/** Close the underlying driver. Safe to call multiple times. */
	cleanup: () => Promise<void>;
}

type Profile = "local" | "managed";

function resolveProfile(): Profile {
	const raw = process.env.TEST_DB_PROFILE ?? "local";
	if (raw === "local" || raw === "managed") return raw;
	throw new Error(`Unknown TEST_DB_PROFILE=${raw}. Expected "local" or "managed".`);
}

/**
 * Path to the dev migrations directory inside data-ops, resolved relative to
 * this file. data-ops generates separate migration sets per environment
 * (dev/stage/prod) and we deliberately use the dev set for tests because
 * that's the migration line that local development bumps first.
 *
 * Resolved at module load (cheap) so per-test setup stays fast.
 */
const MIGRATIONS_FOLDER = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../data-ops/src/drizzle/migrations/dev",
);

/**
 * Local profile: in-memory PGLite. Each call returns a fresh database with
 * the full data-ops dev migration set applied, so adding tables in
 * `data-ops/src/drizzle/schema.ts` flows through to tests for free.
 */
async function createLocalDb(): Promise<TestDbHandle> {
	const pg = new PGlite();
	const db = drizzlePglite(pg) as unknown as TestDb;
	await migratePglite(drizzlePglite(pg), { migrationsFolder: MIGRATIONS_FOLDER });

	let closed = false;
	return {
		db,
		cleanup: async () => {
			if (closed) return;
			closed = true;
			await pg.close();
		},
	};
}

/**
 * Managed profile: a real Neon Postgres database identified by the
 * TEST_DATABASE_URL env var. In CI this is an ephemeral branch created by
 * `neondatabase/create-branch-action` and torn down on PR close. Locally a
 * developer can point this at any Neon branch they own.
 *
 * The connection is HTTP-mode (no pool) which keeps the test process simple
 * — every query is a fresh fetch and there is nothing to clean up beyond
 * the row lifecycle each test manages itself. Schema is bootstrapped with
 * the same migration line as the local profile so the two profiles stay
 * in lockstep.
 */
async function createManagedDb(): Promise<TestDbHandle> {
	const url = process.env.TEST_DATABASE_URL;
	if (!url) {
		throw new Error(
			"TEST_DB_PROFILE=managed requires TEST_DATABASE_URL to be set to a Neon Postgres connection string.",
		);
	}

	const sqlClient = neon(url);
	const db = drizzleNeon(sqlClient) as unknown as TestDb;
	await migrateNeon(drizzleNeon(sqlClient), { migrationsFolder: MIGRATIONS_FOLDER });

	return {
		db,
		// Neon HTTP has no connection to release; the cleanup hook is here
		// for parity with the local profile and so callers don't need to
		// branch on profile.
		cleanup: async () => {},
	};
}

/**
 * Creates a fresh, schema-ready test database. Each call returns an
 * isolated handle (or, in the managed profile, a connection to whatever
 * branch TEST_DATABASE_URL points at — caller is responsible for row-level
 * isolation in that case).
 *
 * Profile is selected by TEST_DB_PROFILE:
 *   - "local"   (default) → in-memory PGLite, fast, no network
 *   - "managed"           → Neon Postgres via TEST_DATABASE_URL
 */
export async function createTestDb(): Promise<TestDbHandle> {
	const profile = resolveProfile();
	if (profile === "managed") return createManagedDb();
	return createLocalDb();
}
