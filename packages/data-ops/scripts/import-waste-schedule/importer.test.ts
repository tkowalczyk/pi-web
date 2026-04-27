import { describe, it, expect, vi } from "vitest";
import { runImport, type ImporterDeps } from "./importer";

const SIMPLE_RAW = {
	region: "Gmina X",
	addresses: [{ city: "X", streets: ["A"] }],
	wasteCollectionSchedule: {
		"1": { mixed: [14, 28], paper: [19] },
		"2": { mixed: [11], glass: [16] },
	},
};

function makeDeps(overrides: Partial<ImporterDeps> = {}): ImporterDeps {
	const findHouseholds = vi.fn().mockResolvedValue([{ id: 1 }]);
	const findExistingSource = vi.fn().mockResolvedValue(null);
	const insertSource = vi
		.fn()
		.mockResolvedValue({ id: 100, name: "X", type: "waste_collection", config: {} });
	const updateSource = vi.fn().mockResolvedValue(undefined);
	const createForumTopic = vi.fn().mockResolvedValue(42);
	const reschedule = vi.fn().mockResolvedValue(undefined);

	return {
		readFile: vi.fn().mockResolvedValue(JSON.stringify(SIMPLE_RAW)),
		findHouseholds,
		findExistingSource,
		insertSource,
		updateSource,
		createForumTopic,
		reschedule,
		log: vi.fn(),
		...overrides,
	};
}

describe("runImport — insert path", () => {
	it("calls insertSource + createForumTopic + updateSource(topicId) when no matching source", async () => {
		const deps = makeDeps();

		await runImport({ file: "2026_4.json", address: "Nieporęt, ul. A", dryRun: false }, deps);

		expect(deps.insertSource).toHaveBeenCalledWith(
			expect.objectContaining({
				householdId: 1,
				name: "Nieporęt, ul. A",
				type: "waste_collection",
				config: expect.objectContaining({ address: "Nieporęt, ul. A" }),
			}),
		);
		expect(deps.createForumTopic).toHaveBeenCalledOnce();
		expect(deps.updateSource).toHaveBeenCalledWith(100, { topicId: 42 });
	});

	it("uses region as default name + address when --address not provided", async () => {
		const deps = makeDeps();

		await runImport({ file: "2026_4.json", dryRun: false }, deps);

		expect(deps.insertSource).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Gmina X",
				config: expect.objectContaining({ address: "Gmina X" }),
			}),
		);
	});

	it("does not call insertSource or createForumTopic when source already exists", async () => {
		const existing: import("./importer").SourceRow = {
			id: 50,
			name: "Nieporęt",
			type: "waste_collection",
			config: { address: "Nieporęt", schedule: [] },
			topicId: 99,
		};
		const deps = makeDeps({
			findExistingSource: vi.fn().mockResolvedValue(existing),
		});

		await runImport({ file: "2026_4.json", address: "Nieporęt", dryRun: false }, deps);

		expect(deps.insertSource).not.toHaveBeenCalled();
		expect(deps.createForumTopic).not.toHaveBeenCalled();
		expect(deps.updateSource).toHaveBeenCalledWith(
			50,
			expect.objectContaining({
				config: expect.objectContaining({ address: "Nieporęt" }),
			}),
		);
	});

	it("findExistingSource called with normalized match key (householdId, type, address)", async () => {
		const deps = makeDeps();

		await runImport({ file: "2026_4.json", address: "Nieporęt, ul. Agawy", dryRun: false }, deps);

		expect(deps.findExistingSource).toHaveBeenCalledWith({
			householdId: 1,
			type: "waste_collection",
			address: "Nieporęt, ul. Agawy",
		});
	});

	it("uses --year flag when provided, overriding filename", async () => {
		const deps = makeDeps();

		await runImport({ file: "2026_4.json", address: "X", year: 2027, dryRun: false }, deps);

		const callArg = (deps.insertSource as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
		const firstDate = (callArg.config.schedule as Array<{ dates: string[] }>)[0]?.dates[0];
		expect(firstDate).toMatch(/^2027-/);
	});

	it("returns summary with totalDates, firstDate, lastDate", async () => {
		const deps = makeDeps();

		const summary = await runImport({ file: "2026_4.json", address: "X", dryRun: false }, deps);

		expect(summary.totalDates).toBe(5);
		expect(summary.firstDate).toBe("2026-01-14");
		expect(summary.lastDate).toBe("2026-02-16");
		expect(summary.action).toBe("insert");
	});
});

describe("runImport — dry run", () => {
	it("makes no DB writes when --dry-run is set", async () => {
		const deps = makeDeps();

		const summary = await runImport({ file: "2026_4.json", address: "X", dryRun: true }, deps);

		expect(deps.insertSource).not.toHaveBeenCalled();
		expect(deps.updateSource).not.toHaveBeenCalled();
		expect(deps.createForumTopic).not.toHaveBeenCalled();
		expect(summary.action).toBe("dry-run");
		expect(summary.sourceId).toBeNull();
	});
});

describe("runImport — scheduler-url", () => {
	it("calls reschedule when --scheduler-url provided", async () => {
		const deps = makeDeps();

		await runImport(
			{
				file: "2026_4.json",
				address: "X",
				schedulerUrl: "https://api.example",
				dryRun: false,
			},
			deps,
		);

		expect(deps.reschedule).toHaveBeenCalledWith(100);
	});

	it("skips reschedule when --scheduler-url not provided", async () => {
		const deps = makeDeps();

		await runImport({ file: "2026_4.json", address: "X", dryRun: false }, deps);

		expect(deps.reschedule).not.toHaveBeenCalled();
	});
});

describe("runImport — household resolution", () => {
	it("uses --household-id override when provided", async () => {
		const deps = makeDeps({
			findHouseholds: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]),
		});

		await runImport({ file: "2026_4.json", address: "X", householdId: 7, dryRun: false }, deps);

		expect(deps.findHouseholds).not.toHaveBeenCalled();
		expect(deps.insertSource).toHaveBeenCalledWith(expect.objectContaining({ householdId: 7 }));
	});

	it("throws when no households exist and no --household-id", async () => {
		const deps = makeDeps({
			findHouseholds: vi.fn().mockResolvedValue([]),
		});

		await expect(
			runImport({ file: "2026_4.json", address: "X", dryRun: false }, deps),
		).rejects.toThrow(/No households/);
	});

	it("throws when multiple households + no --household-id", async () => {
		const deps = makeDeps({
			findHouseholds: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
		});

		await expect(
			runImport({ file: "2026_4.json", address: "X", dryRun: false }, deps),
		).rejects.toThrow(/Multiple households/);
	});
});

describe("runImport — error paths", () => {
	it("throws when filename has no year and --year not provided", async () => {
		const deps = makeDeps();

		await expect(
			runImport({ file: "schedule.json", address: "X", dryRun: false }, deps),
		).rejects.toThrow(/year/);
	});

	it("throws when JSON is invalid against input schema", async () => {
		const deps = makeDeps({
			readFile: vi.fn().mockResolvedValue(JSON.stringify({ region: "X" })),
		});

		await expect(
			runImport({ file: "2026_4.json", address: "X", dryRun: false }, deps),
		).rejects.toThrow();
	});
});
