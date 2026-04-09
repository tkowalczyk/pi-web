import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { PgDatabase } from "drizzle-orm/pg-core";

/**
 * A minimal, structurally-compatible Drizzle PG client used by tests.
 * Intentionally typed as `PgDatabase<any>` so both the PGLite-backed local
 * profile and a future Neon-backed managed profile can fit the same slot.
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
  throw new Error(
    `Unknown TEST_DB_PROFILE=${raw}. Expected "local" or "managed".`,
  );
}

/**
 * Creates a fresh, seeded test database. Each call returns an isolated DB
 * instance so parallel tests do not stomp on each other's rows.
 *
 * Current scope (M1 Phase 1 tracer bullet): only the `cities` table is
 * provisioned. The schema will grow one test at a time as follow-up tests
 * start touching more tables.
 */
export async function createTestDb(): Promise<TestDbHandle> {
  const profile = resolveProfile();

  if (profile === "managed") {
    throw new Error(
      "TEST_DB_PROFILE=managed is not wired up yet. Blocked by: second test in the tracer-bullet series.",
    );
  }

  const pg = new PGlite();
  const db = drizzlePglite(pg) as unknown as TestDb;

  await pg.exec(`
    CREATE TABLE IF NOT EXISTS cities (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

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
