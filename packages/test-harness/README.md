# @repo/test-harness

Shared test infrastructure for the powiadomienia-info monorepo. Provides
DB factories so any package's integration tests can spin up a real-shape
Postgres database with the data-ops dev migration set already applied.

## DB profiles

`createTestDb()` returns a drizzle-orm handle backed by one of two profiles,
selected via the `TEST_DB_PROFILE` env var:

| Profile     | Backend            | When to use                                       |
| ----------- | ------------------ | ------------------------------------------------- |
| `local` (default) | PGLite (in-process Postgres) | Day-to-day TDD. Fast (~600ms cold start), no network. |
| `managed`   | Neon Postgres over HTTP | CI integration runs against real Postgres branches. |

Both profiles bootstrap schema by running the same migration set
(`packages/data-ops/src/drizzle/migrations/dev/`), so adding a table to
`schema.ts` flows through to tests automatically — you do not edit
test-harness when the schema grows.

## Running tests

```bash
# Default: local PGLite, runs the full suite in under a second
pnpm test

# Same as above, explicit
TEST_DB_PROFILE=local pnpm test

# Managed Neon profile against an existing branch URL
TEST_DB_PROFILE=managed TEST_DATABASE_URL="postgresql://..." pnpm test
```

In CI, the `managed` profile runs against an ephemeral Neon branch created
per pull request by `neondatabase/create-branch-action`. The branch is torn
down on PR close — see [`.github/workflows/`](../../.github/workflows/) for
the wiring (delivered as part of issue #13 / PR #12).

## Running the managed profile locally

If you want full Neon fidelity locally (e.g. to debug a CI-only failure):

1. Open the [Neon console](https://console.neon.tech) for the
   `pi-web` project.
2. Create a new branch from `main` (top-right "Branches" → "New branch").
3. Copy its connection string (the **pooled** one is fine).
4. Export it and run:
   ```bash
   export TEST_DATABASE_URL="postgresql://..."
   TEST_DB_PROFILE=managed pnpm test
   ```
5. Delete the branch from the Neon console when done. (CI branches
   auto-delete; ad-hoc local ones do not.)

The managed-profile suite is conditionally skipped when `TEST_DATABASE_URL`
is not set, so the default `pnpm test` invocation never accidentally tries
to dial out.

## Public surface

```ts
import { createTestDb, type TestDbHandle, type TestDb } from "@repo/test-harness";

const handle = await createTestDb();
try {
  // handle.db is a drizzle PgDatabase usable from any data-ops query
  await handle.db.insert(cities).values({ name: "Kraków" });
} finally {
  await handle.cleanup();
}
```

`TestDb` is intentionally typed as `PgDatabase<any, any, any>` so the same
slot accepts both the PGLite and Neon HTTP clients. Production code paths
in `data-ops/database/setup.ts` accept the same shape via the
`initDatabase({ client })` injection seam.

## Roadmap

| Item                                  | Status     | Tracked in |
| ------------------------------------- | ---------- | ---------- |
| Local PGLite profile                  | ✅ Done    | #2         |
| Managed Neon profile                  | ✅ Done    | #13        |
| Schema bootstrap via drizzle migrator | ✅ Done    | #13        |
| `NoopChannel` test double             | 🔜 Pending | #14        |
| Fixture factories (households / members / channels / sources) | 🔜 Blocked by Phase 5 | #14        |
