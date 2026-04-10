import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
	test: {
		name: "data-service",
		globals: true,
		include: ["src/**/*.test.ts"],
		exclude: ["src/**/*.workers.test.ts"],
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
});
