import { RawWasteScheduleInput } from "./input-schema";
import { transformWasteSchedule } from "./transform";
import { extractYearFromFilename } from "./filename";
import { WasteCollectionConfig } from "../../src/zod-schema/waste-collection-config";
import type { ImportOptions } from "./parse-args";

export interface SourceRow {
	id: number;
	name: string;
	type: string;
	config: Record<string, unknown>;
	topicId?: number | null;
}

export interface ImporterDeps {
	readFile(path: string): Promise<string>;
	findHouseholds(): Promise<Array<{ id: number }>>;
	findExistingSource(args: {
		householdId: number;
		type: string;
		address: string;
	}): Promise<SourceRow | null>;
	insertSource(input: {
		householdId: number;
		name: string;
		type: string;
		config: Record<string, unknown>;
	}): Promise<SourceRow>;
	updateSource(
		sourceId: number,
		patch: { config?: Record<string, unknown>; topicId?: number },
	): Promise<unknown>;
	createForumTopic(name: string): Promise<number | null>;
	reschedule(sourceId: number): Promise<void>;
	log(line: string): void;
}

interface ImportSummary {
	householdId: number;
	sourceId: number | null;
	type: "waste_collection";
	address: string;
	totalDates: number;
	firstDate: string | null;
	lastDate: string | null;
	action: "insert" | "update" | "noop" | "dry-run";
}

export async function runImport(
	opts: Pick<
		ImportOptions,
		"file" | "householdId" | "address" | "year" | "schedulerUrl" | "dryRun"
	>,
	deps: ImporterDeps,
): Promise<ImportSummary> {
	const json = await deps.readFile(opts.file);
	const raw = RawWasteScheduleInput.parse(JSON.parse(json));

	const year = opts.year ?? extractYearFromFilename(opts.file);
	if (year === null) {
		throw new Error(`Cannot derive year from filename "${opts.file}" — provide --year explicitly`);
	}

	const address = opts.address ?? raw.region;
	const config = transformWasteSchedule(raw, { year, address });

	const validation = WasteCollectionConfig.safeParse(config);
	if (!validation.success) {
		throw new Error(`Output config does not validate: ${validation.error.message}`);
	}

	const householdId = await resolveHouseholdId(opts.householdId, deps);

	const totalDates = config.schedule.reduce((sum, s) => sum + s.dates.length, 0);
	const allDates = config.schedule.flatMap((s) => s.dates).sort();
	const firstDate = allDates[0] ?? null;
	const lastDate = allDates[allDates.length - 1] ?? null;

	if (opts.dryRun) {
		deps.log(
			`[dry-run] would upsert waste_collection for household=${householdId} address="${address}" totalDates=${totalDates}`,
		);
		return {
			householdId,
			sourceId: null,
			type: "waste_collection",
			address,
			totalDates,
			firstDate,
			lastDate,
			action: "dry-run",
		};
	}

	const existing = await deps.findExistingSource({
		householdId,
		type: "waste_collection",
		address,
	});

	let sourceId: number;
	let action: "insert" | "update";

	if (existing) {
		await deps.updateSource(existing.id, { config });
		sourceId = existing.id;
		action = "update";

		let topicId: number | null = existing.topicId ?? null;
		if (topicId === null) {
			topicId = await deps.createForumTopic(address);
			if (topicId !== null) {
				await deps.updateSource(sourceId, { topicId });
			}
		}
		deps.log(
			`[update] source #${sourceId} address="${address}" topicId=${topicId ?? "null"} totalDates=${totalDates}`,
		);
	} else {
		const inserted = await deps.insertSource({
			householdId,
			name: address,
			type: "waste_collection",
			config,
		});
		sourceId = inserted.id;
		action = "insert";

		const topicId = await deps.createForumTopic(address);
		if (topicId !== null) {
			await deps.updateSource(sourceId, { topicId });
		}
		deps.log(
			`[insert] source #${sourceId} address="${address}" topicId=${topicId ?? "null"} totalDates=${totalDates}`,
		);
	}

	if (opts.schedulerUrl) {
		await deps.reschedule(sourceId);
	}

	return {
		householdId,
		sourceId,
		type: "waste_collection",
		address,
		totalDates,
		firstDate,
		lastDate,
		action,
	};
}

async function resolveHouseholdId(
	requested: number | undefined,
	deps: ImporterDeps,
): Promise<number> {
	if (requested !== undefined) return requested;

	const households = await deps.findHouseholds();
	if (households.length === 0) {
		throw new Error(
			"No households exist — create one first (run `pnpm seed:{env}`) or pass --household-id",
		);
	}
	if (households.length > 1) {
		throw new Error(
			`Multiple households exist (${households.length}) — pass --household-id <id> to disambiguate`,
		);
	}
	return households[0]!.id;
}
