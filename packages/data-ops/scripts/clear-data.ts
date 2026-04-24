/**
 * Clears all data from the database while preserving schema.
 *
 * Usage:
 *   pnpm clear:dev
 *   pnpm clear:stage
 *   pnpm clear:prod
 */
import { sql } from "drizzle-orm";
import { initDatabase, getDb } from "../src/database/setup";

const host = process.env.DATABASE_HOST!;

initDatabase({
	host,
	username: process.env.DATABASE_USERNAME!,
	password: process.env.DATABASE_PASSWORD!,
});

const db = getDb();

async function main() {
	// Order matters — FK dependencies (children first, parents last)
	const tables = [
		"delivery_failures",
		"delivery_log",
		"notification_sources",
		"channels",
		"household_members",
		"households",
		"household_roles",
		// Auth tables
		"auth_verification",
		"auth_session",
		"auth_account",
		"auth_user",
	];

	console.log(`Clearing all data (${host})...`);

	for (const table of tables) {
		try {
			await db.execute(sql.raw(`DELETE FROM "${table}"`));
			console.log(`  ✓ ${table}`);
		} catch (e: any) {
			// Table might not exist yet (no migrations applied)
			console.log(`  ⚠ ${table}: ${e.message.split("\n")[0]}`);
		}
	}

	// Reset serial sequences so IDs start from 1
	const sequences = [
		"delivery_failures_id_seq",
		"delivery_log_id_seq",
		"notification_sources_id_seq",
		"channels_id_seq",
		"household_members_id_seq",
		"households_id_seq",
		"household_roles_id_seq",
	];

	for (const seq of sequences) {
		try {
			await db.execute(sql.raw(`ALTER SEQUENCE "${seq}" RESTART WITH 1`));
		} catch {
			// Sequence might not exist
		}
	}

	console.log(`\n✓ All data cleared. Sequences reset.`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
