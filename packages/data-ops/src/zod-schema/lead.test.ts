import { describe, it, expect } from "vitest";
import { LeadStatus, CreateLeadInput, UpdateLeadStatusInput, UpdateLeadNotesInput } from "./lead";

describe("LeadStatus enum", () => {
	it("accepts each allowed status value", () => {
		for (const value of ["new", "contacted", "interested", "closed_won", "closed_lost"]) {
			expect(LeadStatus.safeParse(value).success).toBe(true);
		}
	});

	it("rejects unknown status values", () => {
		expect(LeadStatus.safeParse("pending").success).toBe(false);
		expect(LeadStatus.safeParse("").success).toBe(false);
	});
});

describe("CreateLeadInput zod schema", () => {
	it("accepts a valid email", () => {
		const result = CreateLeadInput.safeParse({ email: "user@example.com" });
		expect(result.success).toBe(true);
	});

	it("rejects an invalid email format", () => {
		const result = CreateLeadInput.safeParse({ email: "not-an-email" });
		expect(result.success).toBe(false);
	});

	it("rejects an empty email", () => {
		const result = CreateLeadInput.safeParse({ email: "" });
		expect(result.success).toBe(false);
	});

	it("normalizes email to lowercase + trimmed", () => {
		const result = CreateLeadInput.safeParse({ email: "  USER@Example.COM  " });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.email).toBe("user@example.com");
		}
	});
});

describe("UpdateLeadStatusInput zod schema", () => {
	it("accepts a valid status transition", () => {
		const result = UpdateLeadStatusInput.safeParse({ status: "contacted" });
		expect(result.success).toBe(true);
	});

	it("rejects unknown status", () => {
		const result = UpdateLeadStatusInput.safeParse({ status: "spam" });
		expect(result.success).toBe(false);
	});
});

describe("UpdateLeadNotesInput zod schema", () => {
	it("accepts text notes", () => {
		const result = UpdateLeadNotesInput.safeParse({ notes: "Called 2026-05-01" });
		expect(result.success).toBe(true);
	});

	it("accepts null to clear notes", () => {
		const result = UpdateLeadNotesInput.safeParse({ notes: null });
		expect(result.success).toBe(true);
	});
});
