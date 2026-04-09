import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    name: "test-harness",
    globals: true,
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
