/**
 * Read-only inspection of `notification_sources` rows.
 *
 * Usage:
 *   pnpm check:source:{env}              # list all sources (compact)
 *   pnpm check:source:{env} <id>         # detail view of one source
 *
 * Useful for verifying importer / admin UI writes without opening psql.
 */
import { eq } from "drizzle-orm";
import { initDatabase, getDb } from "../src/database/setup";
import { notificationSources } from "../src/drizzle/schema";

async function main() {
	const arg = process.argv[2];

	initDatabase({
		host: process.env.DATABASE_HOST!,
		username: process.env.DATABASE_USERNAME!,
		password: process.env.DATABASE_PASSWORD!,
	});

	if (arg === undefined) {
		await listAll();
	} else {
		const id = Number(arg);
		if (!Number.isInteger(id) || id <= 0) {
			throw new Error(`Invalid source id "${arg}" — must be a positive integer`);
		}
		await detail(id);
	}
}

async function listAll() {
	const rows = await getDb()
		.select({
			id: notificationSources.id,
			householdId: notificationSources.householdId,
			type: notificationSources.type,
			name: notificationSources.name,
			topicId: notificationSources.topicId,
			alertBeforeHours: notificationSources.alertBeforeHours,
			enabled: notificationSources.enabled,
		})
		.from(notificationSources)
		.orderBy(notificationSources.id);

	if (rows.length === 0) {
		console.log("(no notification_sources rows)");
		return;
	}

	console.log(
		`id   household  type                name                                              topic   alert  enabled`,
	);
	console.log(
		`---  ---------  ------------------  ------------------------------------------------  ------  -----  -------`,
	);
	for (const r of rows) {
		const id = String(r.id).padEnd(3);
		const hh = String(r.householdId).padEnd(9);
		const type = (r.type ?? "").padEnd(18);
		const name = (r.name ?? "").slice(0, 48).padEnd(48);
		const topic = String(r.topicId ?? "—").padEnd(6);
		const alert = String(r.alertBeforeHours ?? "—").padEnd(5);
		const enabled = r.enabled ? "true" : "false";
		console.log(`${id}  ${hh}  ${type}  ${name}  ${topic}  ${alert}  ${enabled}`);
	}
	console.log(`\n${rows.length} row${rows.length === 1 ? "" : "s"}`);
}

async function detail(id: number) {
	const [row] = await getDb()
		.select()
		.from(notificationSources)
		.where(eq(notificationSources.id, id));

	if (!row) {
		console.log(`(no notification_source with id=${id})`);
		process.exit(1);
	}

	console.log(JSON.stringify(row, null, 2));
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e instanceof Error ? e.message : e);
		process.exit(1);
	});
