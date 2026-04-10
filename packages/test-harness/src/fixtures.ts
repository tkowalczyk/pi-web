import { randomUUID } from "node:crypto";
import type { TestDb } from "./db";
import {
	pgTable,
	serial,
	text,
	timestamp,
	boolean,
	integer,
	index,
	jsonb,
} from "drizzle-orm/pg-core";

// ─── Inline table references ──────────────────────────────────────────
// We duplicate the minimal table definitions here instead of importing from
// data-ops to keep the test-harness free of build-order dependencies on
// data-ops dist/. The shapes mirror data-ops/src/drizzle/schema.ts and
// auth-schema.ts — if schema changes, these must be updated too.

const auth_user = pgTable("auth_user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const households = pgTable("households", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const householdRoles = pgTable("household_roles", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const householdMembers = pgTable("household_members", {
	id: serial("id").primaryKey(),
	householdId: integer("household_id").notNull(),
	userId: text("user_id").notNull(),
	roleId: integer("role_id").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const channels = pgTable("channels", {
	id: serial("id").primaryKey(),
	householdId: integer("household_id").notNull(),
	type: text("type").notNull(),
	config: jsonb("config").notNull().default({}),
	enabled: boolean("enabled").default(true).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const notificationSources = pgTable("notification_sources", {
	id: serial("id").primaryKey(),
	householdId: integer("household_id").notNull(),
	name: text("name").notNull(),
	type: text("type").notNull(),
	config: jsonb("config").notNull().default({}),
	enabled: boolean("enabled").default(true).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Counters for unique defaults ──────────────────────────────────────
let counter = 0;
function next(): number {
	return ++counter;
}

// ─── Factory functions ─────────────────────────────────────────────────

export async function createHousehold(db: TestDb, overrides: { name?: string } = {}) {
	const [row] = await db
		.insert(households)
		.values({ name: overrides.name ?? `Test Household ${next()}` })
		.returning();
	return row!;
}

export async function createHouseholdRole(
	db: TestDb,
	overrides: { name?: string; description?: string } = {},
) {
	const n = next();
	const [row] = await db
		.insert(householdRoles)
		.values({
			name: overrides.name ?? `role-${n}`,
			description: overrides.description ?? null,
		})
		.returning();
	return row!;
}

export async function createHouseholdMember(
	db: TestDb,
	overrides: { householdId: number; roleId: number; userId?: string },
) {
	const userId = overrides.userId ?? (await createTestUser(db)).id;
	const [row] = await db
		.insert(householdMembers)
		.values({
			householdId: overrides.householdId,
			userId,
			roleId: overrides.roleId,
		})
		.returning();
	return row!;
}

export async function createChannel(
	db: TestDb,
	overrides: {
		householdId: number;
		type?: string;
		config?: Record<string, unknown>;
		enabled?: boolean;
	},
) {
	const [row] = await db
		.insert(channels)
		.values({
			householdId: overrides.householdId,
			type: overrides.type ?? "noop",
			config: overrides.config ?? {},
			enabled: overrides.enabled ?? true,
		})
		.returning();
	return row!;
}

export async function createNotificationSource(
	db: TestDb,
	overrides: {
		householdId: number;
		name?: string;
		type?: string;
		config?: Record<string, unknown>;
		enabled?: boolean;
	},
) {
	const n = next();
	const [row] = await db
		.insert(notificationSources)
		.values({
			householdId: overrides.householdId,
			name: overrides.name ?? `Test Source ${n}`,
			type: overrides.type ?? "test",
			config: overrides.config ?? {},
			enabled: overrides.enabled ?? true,
		})
		.returning();
	return row!;
}

// ─── Helper: create a minimal auth_user for FK satisfaction ────────────

async function createTestUser(db: TestDb) {
	const id = randomUUID();
	const n = next();
	const [row] = await db
		.insert(auth_user)
		.values({
			id,
			name: `Test User ${n}`,
			email: `test-${n}-${id.slice(0, 8)}@example.com`,
			emailVerified: false,
		})
		.returning();
	return row!;
}
