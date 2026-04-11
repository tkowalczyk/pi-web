import { describe, it, expect } from "vitest";

describe("Query Function Exports", () => {
	it("should export user query functions", async () => {
		const userQueries = await import("../src/queries/user");
		expect(typeof userQueries.getUserProfile).toBe("function");
		expect(typeof userQueries.updateUserPhone).toBe("function");
	});
});
