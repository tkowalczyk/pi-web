# Test-Harness Dual DB Profile Pattern

Reference document for the `/setup-ci` skill. Describes the test-harness
`createTestDb()` pattern that gives every test a real-shape Postgres
database backed by either PGLite (local, fast) or Neon (CI, real Postgres).

## Core idea

One function, two backends, same migrations, same interface.

```
createTestDb()
     │
     ├── TEST_DB_PROFILE=local → PGLite (in-memory, no network)
     │   └── drizzle-orm/pglite + drizzle-orm/pglite/migrator
     │
     └── TEST_DB_PROFILE=managed → Neon HTTP (real Postgres, needs URL)
         └── @neondatabase/serverless + drizzle-orm/neon-http + migrator
```

Both profiles:
- Apply the SAME migration set from the data-ops package
- Return the SAME `TestDbHandle` type (`{ db: PgDatabase, cleanup() }`)
- Are interchangeable from the caller's perspective

## db.ts template

```typescript
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { neon } from "@neondatabase/serverless";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";

export type TestDb = PgDatabase<any, any, any>;

export interface TestDbHandle {
  db: TestDb;
  cleanup: () => Promise<void>;
}

type Profile = "local" | "managed";

function resolveProfile(): Profile {
  const raw = process.env.TEST_DB_PROFILE ?? "local";
  if (raw === "local" || raw === "managed") return raw;
  throw new Error(
    `Unknown TEST_DB_PROFILE=${raw}. Expected "local" or "managed".`
  );
}

// Resolve migration path relative to THIS file, not cwd.
// Adapt the relative path to your project's layout.
const MIGRATIONS_FOLDER = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../data-ops/src/drizzle/migrations/dev"
);

async function createLocalDb(): Promise<TestDbHandle> {
  const pg = new PGlite();
  const db = drizzlePglite(pg) as unknown as TestDb;
  await migratePglite(drizzlePglite(pg), {
    migrationsFolder: MIGRATIONS_FOLDER,
  });

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

async function createManagedDb(): Promise<TestDbHandle> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DB_PROFILE=managed requires TEST_DATABASE_URL."
    );
  }

  const sqlClient = neon(url);
  const db = drizzleNeon(sqlClient) as unknown as TestDb;
  await migrateNeon(drizzleNeon(sqlClient), {
    migrationsFolder: MIGRATIONS_FOLDER,
  });

  return { db, cleanup: async () => {} };
}

export async function createTestDb(): Promise<TestDbHandle> {
  const profile = resolveProfile();
  if (profile === "managed") return createManagedDb();
  return createLocalDb();
}
```

## Injection seam in data-ops

The data-ops package must expose a way to inject a test DB into its
global slot. This is the bridge between test-harness and query code.

```typescript
// data-ops/database/setup.ts

let db: PgDatabase | undefined;

// Production path
export function initDatabase(config: ConnectionConfig): PgDatabase;
// Test injection path
export function initDatabase(config: { client: PgDatabase }): PgDatabase;

export function initDatabase(config) {
  if (db) return db;
  if ("client" in config) { db = config.client; return db; }
  // ... production Neon HTTP connection
}

export function getDb(): PgDatabase {
  if (!db) throw new Error("Database not initialized");
  return db;
}

// Tests call this between runs
export function resetDatabase(): void { db = undefined; }
```

## Test pattern

```typescript
// data-ops/tests/integration/example.test.ts
import { createTestDb, type TestDbHandle } from "@repo/test-harness";
import { initDatabase, resetDatabase } from "@/database/setup";
import { cities } from "@/drizzle/schema";
import { getCities } from "@/queries/address";

describe("example roundtrip", () => {
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

  it("queries return inserted rows", async () => {
    await handle.db.insert(cities).values({ name: "Test" });
    const result = await getCities();
    expect(result[0].name).toBe("Test");
  });
});
```

## Managed-profile-only test (conditional)

```typescript
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.runIf(TEST_DATABASE_URL)("managed profile", () => {
  let handle: TestDbHandle;

  beforeEach(() => { vi.stubEnv("TEST_DB_PROFILE", "managed"); });
  afterEach(async () => {
    if (handle) await handle.cleanup();
    vi.unstubAllEnvs();
  });

  it("connects to real Postgres", async () => {
    handle = await createTestDb();
    const result = await handle.db.execute(sql`select 1 as one`);
    expect(result).toBeDefined();
  });
});
```

## Dependencies (test-harness package.json)

```json
{
  "dependencies": {
    "@electric-sql/pglite": "^0.2.17",
    "@neondatabase/serverless": "^1.0.2",
    "drizzle-orm": "^0.44.5"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.x"
  }
}
```

## Migration bootstrap: why migrations, not raw DDL

The original tracer bullet used raw `CREATE TABLE` in test-harness:

```typescript
// BAD: hand-rolled DDL drifts from schema.ts
await pg.exec(`CREATE TABLE cities (id SERIAL PRIMARY KEY, ...)`);
```

Problem: every time you add a table to `schema.ts` and generate a
migration, you ALSO have to update test-harness. Two sources of truth
that drift apart.

Solution: use drizzle's migrator to apply the same `.sql` files that
production uses:

```typescript
// GOOD: single source of truth
await migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER });
```

The migrator:
- Reads every `.sql` file from the folder, ordered by filename
- Tracks which migrations have been applied in `__drizzle_migrations` table
- Is idempotent — running twice is safe
- Works identically on PGLite and Neon HTTP

This means adding a table is a one-step process:
1. Edit `schema.ts` → `pnpm drizzle:dev:generate` → new `.sql` appears
2. Tests automatically see the new table on next run

Zero test-harness edits required.
