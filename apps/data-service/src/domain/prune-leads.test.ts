import { describe, it, expect, vi } from "vitest";
import { pruneOldLeads, computeLeadCutoff } from "./prune-leads";

describe("computeLeadCutoff", () => {
	it("returns a Date 3 months before the given reference time", () => {
		const now = new Date("2026-05-04T12:00:00.000Z");
		const cutoff = computeLeadCutoff(now);
		expect(cutoff.toISOString()).toBe("2026-02-04T12:00:00.000Z");
	});

	it("handles month underflow across the year boundary", () => {
		const now = new Date("2026-01-15T08:30:00.000Z");
		const cutoff = computeLeadCutoff(now);
		expect(cutoff.toISOString()).toBe("2025-10-15T08:30:00.000Z");
	});
});

describe("pruneOldLeads", () => {
	it("calls deleteLeadsOlderThan with cutoff = now - 3 months", async () => {
		const now = new Date("2026-05-04T12:00:00.000Z");
		const deleteLeadsOlderThan = vi.fn().mockResolvedValue(0);

		await pruneOldLeads({ now: () => now, deleteLeadsOlderThan });

		expect(deleteLeadsOlderThan).toHaveBeenCalledOnce();
		const arg = deleteLeadsOlderThan.mock.calls[0]?.[0] as Date;
		expect(arg.toISOString()).toBe("2026-02-04T12:00:00.000Z");
	});

	it("returns the number of deleted rows reported by deps", async () => {
		const deleteLeadsOlderThan = vi.fn().mockResolvedValue(7);

		const result = await pruneOldLeads({
			now: () => new Date("2026-05-04T12:00:00.000Z"),
			deleteLeadsOlderThan,
		});

		expect(result).toEqual({ deletedCount: 7 });
	});

	it("is idempotent — succeeds with 0 deletions when no old leads exist", async () => {
		const deleteLeadsOlderThan = vi.fn().mockResolvedValue(0);

		const result = await pruneOldLeads({
			now: () => new Date("2026-05-04T12:00:00.000Z"),
			deleteLeadsOlderThan,
		});

		expect(result).toEqual({ deletedCount: 0 });
		expect(deleteLeadsOlderThan).toHaveBeenCalledOnce();
	});
});
