import { describe, it, expect, vi } from "vitest";
import { dispatchScheduled, PRUNE_LEADS_CRON } from "./scheduled";

describe("dispatchScheduled", () => {
	it("runs the prune-leads job when the daily cron expression fires", async () => {
		const runPruneLeads = vi.fn().mockResolvedValue(undefined);
		const runSelfAlert = vi.fn().mockResolvedValue(undefined);

		await dispatchScheduled(PRUNE_LEADS_CRON, { runPruneLeads, runSelfAlert });

		expect(runPruneLeads).toHaveBeenCalledOnce();
		expect(runSelfAlert).not.toHaveBeenCalled();
	});

	it("runs the self-alert job for the hourly cron expression", async () => {
		const runPruneLeads = vi.fn().mockResolvedValue(undefined);
		const runSelfAlert = vi.fn().mockResolvedValue(undefined);

		await dispatchScheduled("0 * * * *", { runPruneLeads, runSelfAlert });

		expect(runSelfAlert).toHaveBeenCalledOnce();
		expect(runPruneLeads).not.toHaveBeenCalled();
	});

	it("falls back to self-alert for any unrecognised cron expression", async () => {
		const runPruneLeads = vi.fn().mockResolvedValue(undefined);
		const runSelfAlert = vi.fn().mockResolvedValue(undefined);

		await dispatchScheduled("*/5 * * * *", { runPruneLeads, runSelfAlert });

		expect(runSelfAlert).toHaveBeenCalledOnce();
		expect(runPruneLeads).not.toHaveBeenCalled();
	});
});
