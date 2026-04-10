import { defineConfig } from "vitest/config";

/**
 * Root vitest config using the projects pattern so `pnpm test` runs every
 * workspace package's suite in one invocation. Each project keeps its own
 * local vitest.config.ts — this file only aggregates.
 *
 * Profiles:
 * - default (`pnpm test`)        → local PGLite DB (fast, no network)
 * - `pnpm test:ci`               → managed Postgres branch via DATABASE_URL
 *
 * The profile is selected by TEST_DB_PROFILE env var, read inside
 * test-harness/createTestDb().
 */
export default defineConfig({
	test: {
		projects: ["packages/data-ops/vitest.config.ts", "packages/test-harness/vitest.config.ts"],
	},
});
