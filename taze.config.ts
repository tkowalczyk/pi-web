import { defineConfig } from "taze";

/**
 * Dependency freshness checker. Runs in CI as advisory (non-blocking)
 * via `pnpm deps`. Recursive across all workspace packages, minor-only
 * bumps by default so weekly updates stay routine; `pnpm deps:major`
 * surfaces breaking upgrades when someone wants to look at them.
 */
export default defineConfig({
	recursive: true,
	mode: "minor",
});
