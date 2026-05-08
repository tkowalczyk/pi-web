import { defineConfig } from "vitest/config";

/**
 * Root vitest config using the projects pattern so `pnpm test` runs every
 * workspace package's suite in one invocation. Each project keeps its own
 * local vitest.config.ts — this file only aggregates.
 */
export default defineConfig({
	test: {
		projects: [
			"packages/data-ops/vitest.config.ts",
			"apps/data-service/vitest.config.ts",
			"apps/data-service/vitest.workers.config.mts",
			"apps/user-application/vitest.config.ts",
		],
	},
});
