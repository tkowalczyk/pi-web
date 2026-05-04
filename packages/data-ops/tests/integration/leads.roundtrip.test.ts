import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDbHandle } from "@repo/test-harness";
import { initDatabase, resetDatabase } from "@/database/setup";
import {
	insertLead,
	listLeads,
	updateLeadStatus,
	updateLeadNotes,
	deleteLead,
	deleteLeadsOlderThan,
} from "@/queries/leads";
import { leads } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { LeadResponse } from "@/zod-schema/lead";

describe("leads — insertLead + listLeads (data-ops ↔ test-harness)", () => {
	let handle: TestDbHandle;

	beforeEach(async () => {
		handle = await createTestDb();
		resetDatabase();
		initDatabase({ client: handle.db });
	});

	afterEach(async () => {
		resetDatabase();
		await handle.cleanup();
	});

	it("inserts a lead with email + consentGivenAt and defaults status to 'new'", async () => {
		const consent = new Date("2026-04-30T10:00:00Z");
		const lead = await insertLead({
			email: "user@example.com",
			consentGivenAt: consent,
		});

		expect(lead.id).toBeGreaterThan(0);
		expect(lead.email).toBe("user@example.com");
		expect(lead.status).toBe("new");
		expect(lead.notes).toBeNull();
		expect(lead.consentGivenAt.toISOString()).toBe(consent.toISOString());

		const parsed = LeadResponse.parse(lead);
		expect(parsed.id).toBe(lead.id);
	});

	it("listLeads returns leads sorted by createdAt descending", async () => {
		const consent = new Date("2026-04-30T10:00:00Z");
		const first = await insertLead({ email: "first@example.com", consentGivenAt: consent });
		// guarantee distinct createdAt — Postgres now() resolves to microseconds but
		// PGLite + back-to-back inserts can collide; force a delay.
		await new Promise((r) => setTimeout(r, 5));
		const second = await insertLead({ email: "second@example.com", consentGivenAt: consent });

		const rows = await listLeads();
		expect(rows.map((r) => r.id)).toEqual([second.id, first.id]);
	});

	it("listLeads returns empty array when no leads exist", async () => {
		const rows = await listLeads();
		expect(rows).toEqual([]);
	});

	it("updateLeadStatus changes status and returns updated row", async () => {
		const lead = await insertLead({
			email: "u@example.com",
			consentGivenAt: new Date(),
		});

		const updated = await updateLeadStatus(lead.id, "contacted");
		expect(updated.status).toBe("contacted");
		expect(updated.id).toBe(lead.id);
	});

	it("updateLeadNotes writes text and accepts null to clear", async () => {
		const lead = await insertLead({
			email: "u@example.com",
			consentGivenAt: new Date(),
		});

		const withNote = await updateLeadNotes(lead.id, "Called 2026-05-01");
		expect(withNote.notes).toBe("Called 2026-05-01");

		const cleared = await updateLeadNotes(lead.id, null);
		expect(cleared.notes).toBeNull();
	});

	it("deleteLead removes the row", async () => {
		const lead = await insertLead({
			email: "gone@example.com",
			consentGivenAt: new Date(),
		});

		await deleteLead(lead.id);

		const rows = await listLeads();
		expect(rows.find((r) => r.id === lead.id)).toBeUndefined();
	});

	it("deleteLeadsOlderThan removes leads with createdAt < cutoff and returns the deleted count", async () => {
		const now = new Date("2026-05-04T12:00:00Z");
		const cutoff = new Date("2026-02-04T12:00:00Z");

		const fourMonthsAgo = await insertLead({
			email: "old@example.com",
			consentGivenAt: now,
		});
		const twoMonthsAgo = await insertLead({
			email: "fresh@example.com",
			consentGivenAt: now,
		});

		// Backdate one row past the cutoff, leave the other inside the window.
		await handle.db
			.update(leads)
			.set({ createdAt: new Date("2026-01-04T12:00:00Z") })
			.where(eq(leads.id, fourMonthsAgo.id));
		await handle.db
			.update(leads)
			.set({ createdAt: new Date("2026-03-04T12:00:00Z") })
			.where(eq(leads.id, twoMonthsAgo.id));

		const deleted = await deleteLeadsOlderThan(cutoff);
		expect(deleted).toBe(1);

		const remaining = await listLeads();
		expect(remaining.map((r) => r.id)).toEqual([twoMonthsAgo.id]);
	});

	it("deleteLeadsOlderThan is idempotent — running twice with no old leads returns 0 and does not error", async () => {
		const cutoff = new Date("2026-02-04T12:00:00Z");
		await insertLead({
			email: "fresh@example.com",
			consentGivenAt: new Date("2026-04-30T10:00:00Z"),
		});

		const firstRun = await deleteLeadsOlderThan(cutoff);
		const secondRun = await deleteLeadsOlderThan(cutoff);

		expect(firstRun).toBe(0);
		expect(secondRun).toBe(0);
		expect((await listLeads()).length).toBe(1);
	});

	it("deleteLeadsOlderThan does not delete leads at exactly the cutoff timestamp", async () => {
		const cutoff = new Date("2026-02-04T12:00:00.000Z");
		const lead = await insertLead({
			email: "edge@example.com",
			consentGivenAt: cutoff,
		});
		await handle.db.update(leads).set({ createdAt: cutoff }).where(eq(leads.id, lead.id));

		const deleted = await deleteLeadsOlderThan(cutoff);
		expect(deleted).toBe(0);
		expect((await listLeads()).length).toBe(1);
	});
});
