/**
 * Seeds the database with base data: roles, household, and links
 * the first auth_user to the household as admin.
 *
 * Idempotent — skips rows that already exist.
 *
 * Usage:
 *   pnpm seed:dev
 *   pnpm seed:stage
 *   pnpm seed:prod
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
	console.log(`Seeding database (${host})...\n`);

	// 1. Household roles
	const roles = [
		{ name: "admin", description: "Administrator" },
		{ name: "member", description: "Członek rodziny" },
	];

	for (const role of roles) {
		const existing = await db.execute(
			sql.raw(`SELECT id FROM household_roles WHERE name = '${role.name}'`),
		);
		if (existing.rows.length > 0) {
			console.log(`  ⏭ Role "${role.name}" already exists (id=${existing.rows[0].id})`);
		} else {
			const result = await db.execute(
				sql.raw(
					`INSERT INTO household_roles (name, description) VALUES ('${role.name}', '${role.description}') RETURNING id`,
				),
			);
			console.log(`  ✓ Role "${role.name}" created (id=${result.rows[0].id})`);
		}
	}

	// 2. Household
	const householdName = "Dom";
	const timezone = "Europe/Warsaw";

	const existingHousehold = await db.execute(sql.raw(`SELECT id FROM households LIMIT 1`));

	let householdId: number;
	if (existingHousehold.rows.length > 0) {
		householdId = existingHousehold.rows[0].id as number;
		console.log(`  ⏭ Household already exists (id=${householdId})`);
	} else {
		const result = await db.execute(
			sql.raw(
				`INSERT INTO households (name, timezone) VALUES ('${householdName}', '${timezone}') RETURNING id`,
			),
		);
		householdId = result.rows[0].id as number;
		console.log(`  ✓ Household "${householdName}" created (id=${householdId})`);
	}

	// 3. Link first auth_user to household as admin
	const firstUser = await db.execute(
		sql.raw(`SELECT id, email FROM auth_user ORDER BY created_at ASC LIMIT 1`),
	);

	if (firstUser.rows.length === 0) {
		console.log(`\n⚠ No auth_user found. Register a user first, then re-run seed.`);
	} else {
		const userId = firstUser.rows[0].id as string;
		const email = firstUser.rows[0].email as string;

		const adminRole = await db.execute(
			sql.raw(`SELECT id FROM household_roles WHERE name = 'admin'`),
		);
		const roleId = adminRole.rows[0].id as number;

		const existingMember = await db.execute(
			sql.raw(
				`SELECT id FROM household_members WHERE user_id = '${userId}' AND household_id = ${householdId}`,
			),
		);

		if (existingMember.rows.length > 0) {
			console.log(`  ⏭ User "${email}" already member of household`);
		} else {
			await db.execute(
				sql.raw(
					`INSERT INTO household_members (household_id, user_id, role_id) VALUES (${householdId}, '${userId}', ${roleId})`,
				),
			);
			console.log(`  ✓ User "${email}" linked to household as admin`);
		}
	}

	console.log(`\n✓ Seed complete.`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
