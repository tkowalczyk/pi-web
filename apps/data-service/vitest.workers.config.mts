import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "src"),
		},
	},
	test: {
		name: "data-service-workers",
		globals: true,
		include: ["src/**/*.workers.test.ts"],
	},
});
