import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDbHandle } from "@repo/test-harness";
import { initDatabase, resetDatabase } from "@repo/data-ops/database/setup";
import { listLeads } from "@repo/data-ops/queries/leads";
import { submitLeadHandler, TurnstileVerificationError } from "./submit-lead";

describe("submitLeadHandler", () => {
	let handle: TestDbHandle;
	const fixedNow = new Date("2026-04-30T12:34:56.000Z");

	beforeEach(async () => {
		handle = await createTestDb();
		resetDatabase();
		initDatabase({ client: handle.db });
	});

	afterEach(async () => {
		resetDatabase();
		await handle.cleanup();
	});

	function deps(verifyResult: boolean, notify = vi.fn().mockResolvedValue(undefined)) {
		return {
			verifyToken: async () => ({ success: verifyResult }),
			now: () => fixedNow,
			notify,
		};
	}

	it("inserts a lead with status='new' and consentGivenAt=now() on valid input", async () => {
		const result = await submitLeadHandler(
			{
				email: "user@example.com",
				consent: true,
				turnstileToken: "valid-token",
			},
			deps(true),
		);

		expect(result.success).toBe(true);

		const rows = await listLeads();
		expect(rows).toHaveLength(1);
		const row = rows[0]!;
		expect(row.email).toBe("user@example.com");
		expect(row.status).toBe("new");
		expect(row.consentGivenAt.toISOString()).toBe(fixedNow.toISOString());
	});

	it("throws TurnstileVerificationError when verify returns false; no DB write", async () => {
		await expect(
			submitLeadHandler(
				{
					email: "user@example.com",
					consent: true,
					turnstileToken: "bad-token",
				},
				deps(false),
			),
		).rejects.toBeInstanceOf(TurnstileVerificationError);

		expect(await listLeads()).toHaveLength(0);
	});

	it("rejects invalid email; no DB write", async () => {
		await expect(
			submitLeadHandler({ email: "not-an-email", consent: true, turnstileToken: "t" }, deps(true)),
		).rejects.toThrow();

		expect(await listLeads()).toHaveLength(0);
	});

	it("rejects consent=false; no DB write", async () => {
		await expect(
			submitLeadHandler(
				{ email: "user@example.com", consent: false, turnstileToken: "t" },
				deps(true),
			),
		).rejects.toThrow();

		expect(await listLeads()).toHaveLength(0);
	});

	it("rejects empty turnstileToken; no DB write", async () => {
		await expect(
			submitLeadHandler(
				{ email: "user@example.com", consent: true, turnstileToken: "" },
				deps(true),
			),
		).rejects.toThrow();

		expect(await listLeads()).toHaveLength(0);
	});

	it("calls notify with email + createdAt after successful insert", async () => {
		const notify = vi.fn().mockResolvedValue(undefined);
		await submitLeadHandler(
			{ email: "lead@example.com", consent: true, turnstileToken: "valid-token" },
			deps(true, notify),
		);

		expect(notify).toHaveBeenCalledTimes(1);
		expect(notify).toHaveBeenCalledWith({
			email: "lead@example.com",
			createdAt: fixedNow,
		});
	});

	it("returns success even if notify rejects (delivery failure must not fail the insert)", async () => {
		const notify = vi.fn().mockRejectedValue(new Error("TG down"));
		const result = await submitLeadHandler(
			{ email: "lead@example.com", consent: true, turnstileToken: "valid-token" },
			deps(true, notify),
		);

		expect(result.success).toBe(true);
		expect(await listLeads()).toHaveLength(1);
	});

	it("normalizes email to lowercase before insert", async () => {
		await submitLeadHandler(
			{
				email: "  USER@Example.COM  ",
				consent: true,
				turnstileToken: "valid-token",
			},
			deps(true),
		);

		const rows = await listLeads();
		expect(rows[0]!.email).toBe("user@example.com");
	});
});
