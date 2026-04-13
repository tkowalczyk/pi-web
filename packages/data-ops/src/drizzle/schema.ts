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
import { auth_user } from "./auth-schema";

// ─── Domain model (M1-P5) ───────────────────────────────────────────

export const householdRoles = pgTable("household_roles", {
	id: serial("id").primaryKey(),
	name: text("name").notNull().unique(),
	description: text("description"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

export const households = pgTable("households", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	timezone: text("timezone").notNull().default("Europe/Warsaw"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

export const householdMembers = pgTable(
	"household_members",
	{
		id: serial("id").primaryKey(),
		householdId: integer("household_id")
			.notNull()
			.references(() => households.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => auth_user.id, { onDelete: "cascade" }),
		roleId: integer("role_id")
			.notNull()
			.references(() => householdRoles.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("hm_household_id_idx").on(table.householdId),
		index("hm_user_id_idx").on(table.userId),
	],
);

export const channels = pgTable(
	"channels",
	{
		id: serial("id").primaryKey(),
		householdId: integer("household_id")
			.notNull()
			.references(() => households.id, { onDelete: "cascade" }),
		type: text("type").notNull(),
		config: jsonb("config").notNull().default({}),
		enabled: boolean("enabled").default(true).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("channels_household_id_idx").on(table.householdId)],
);

export const notificationSources = pgTable(
	"notification_sources",
	{
		id: serial("id").primaryKey(),
		householdId: integer("household_id")
			.notNull()
			.references(() => households.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		type: text("type").notNull(),
		config: jsonb("config").notNull().default({}),
		alertBeforeHours: integer("alert_before_hours"),
		topicId: integer("topic_id"),
		enabled: boolean("enabled").default(true).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("ns_household_id_idx").on(table.householdId)],
);

export const deliveryLog = pgTable(
	"delivery_log",
	{
		id: serial("id").primaryKey(),
		sourceId: integer("source_id")
			.notNull()
			.references(() => notificationSources.id, { onDelete: "cascade" }),
		channel: text("channel").notNull(),
		status: text("status").notNull(),
		error: text("error"),
		retryCount: integer("retry_count").notNull().default(0),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("dl_source_id_idx").on(table.sourceId),
		index("dl_status_idx").on(table.status),
		index("dl_created_at_idx").on(table.createdAt),
	],
);

export const deliveryFailures = pgTable(
	"delivery_failures",
	{
		id: serial("id").primaryKey(),
		sourceId: integer("source_id")
			.notNull()
			.references(() => notificationSources.id, { onDelete: "cascade" }),
		channel: text("channel").notNull(),
		error: text("error").notNull(),
		retryCount: integer("retry_count").notNull(),
		payload: jsonb("payload").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("df_source_id_idx").on(table.sourceId),
		index("df_created_at_idx").on(table.createdAt),
	],
);

// Legacy tables (cities, streets, addresses, waste_schedules, waste_types,
// notification_preferences, notification_logs) removed in M2-P2 migration.
