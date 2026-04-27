import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDbHandle } from "@repo/test-harness/db";
import { initDatabase, resetDatabase } from "../../src/database/setup";
import { notificationSources } from "../../src/drizzle/schema";
import { buildDbDeps } from "./db-deps";
import { runImport } from "./importer";

let handle: TestDbHandle;

beforeEach(async () => {
	resetDatabase();
	handle = await createTestDb();
	initDatabase({ client: handle.db });
	// Migration 0013 already seeds a "Dom" household + admin/member roles.
});

afterEach(async () => {
	await handle.cleanup();
	resetDatabase();
});

describe("integration: runImport with PGLite-backed db-deps", () => {
	it("inserts one waste_collection notification_source with correct config JSONB", async () => {
		const SIMPLE_RAW = {
			region: "Gmina X",
			addresses: [{ city: "X", streets: ["A"] }],
			wasteCollectionSchedule: {
				"1": { mixed: [14, 28] },
				"2": { paper: [16] },
			},
		};

		const deps = buildDbDeps({
			readFile: async () => JSON.stringify(SIMPLE_RAW),
			createForumTopic: async () => null,
			reschedule: async () => undefined,
			log: () => undefined,
		});

		const summary = await runImport(
			{ file: "2026_4.json", address: "Nieporęt, ul. Agawy", dryRun: false },
			deps,
		);

		expect(summary.action).toBe("insert");
		expect(summary.totalDates).toBe(3);

		const rows = await handle.db.select().from(notificationSources);
		expect(rows.length).toBe(1);
		const [row] = rows;
		expect(row.type).toBe("waste_collection");
		expect(row.name).toBe("Nieporęt, ul. Agawy");
		const config = row.config as {
			address: string;
			schedule: Array<{ type: string; dates: string[] }>;
		};
		expect(config.address).toBe("Nieporęt, ul. Agawy");
		const byType = Object.fromEntries(config.schedule.map((s) => [s.type, s.dates]));
		expect(byType.mixed).toEqual(["2026-01-14", "2026-01-28"]);
		expect(byType.paper).toEqual(["2026-02-16"]);
	});

	it("re-running with same input does not duplicate (idempotent update)", async () => {
		const SIMPLE_RAW = {
			region: "Gmina X",
			addresses: [],
			wasteCollectionSchedule: { "1": { mixed: [14] } },
		};

		const deps = buildDbDeps({
			readFile: async () => JSON.stringify(SIMPLE_RAW),
			createForumTopic: async () => 99,
			reschedule: async () => undefined,
			log: () => undefined,
		});

		await runImport({ file: "2026_4.json", address: "X", dryRun: false }, deps);

		const summary2 = await runImport({ file: "2026_4.json", address: "X", dryRun: false }, deps);

		expect(summary2.action).toBe("update");
		const rows = await handle.db.select().from(notificationSources);
		expect(rows.length).toBe(1);
		expect(rows[0].topicId).toBe(99);
	});

	it("dry-run writes nothing to DB", async () => {
		const SIMPLE_RAW = {
			region: "Gmina X",
			addresses: [],
			wasteCollectionSchedule: { "1": { mixed: [14] } },
		};

		const deps = buildDbDeps({
			readFile: async () => JSON.stringify(SIMPLE_RAW),
			createForumTopic: async () => null,
			reschedule: async () => undefined,
			log: () => undefined,
		});

		await runImport({ file: "2026_4.json", address: "X", dryRun: true }, deps);

		const rows = await handle.db.select().from(notificationSources);
		expect(rows.length).toBe(0);
	});
});
