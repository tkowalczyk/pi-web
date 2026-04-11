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

// ─── Legacy tables ──────────────────────────────────────────────────

export const cities = pgTable("cities", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

export const streets = pgTable(
	"streets",
	{
		id: serial("id").primaryKey(),
		name: text("name").notNull(),
		cityId: integer("city_id")
			.notNull()
			.references(() => cities.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("streets_city_id_idx").on(table.cityId)],
);

export const addresses = pgTable(
	"addresses",
	{
		id: serial("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => auth_user.id, { onDelete: "cascade" }),
		cityId: integer("city_id")
			.notNull()
			.references(() => cities.id, { onDelete: "restrict" }),
		streetId: integer("street_id")
			.notNull()
			.references(() => streets.id, { onDelete: "restrict" }),
		isDefault: boolean("is_default").default(false).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("addresses_user_id_idx").on(table.userId),
		index("addresses_city_id_idx").on(table.cityId),
	],
);

export const notification_preferences = pgTable(
	"notification_preferences",
	{
		id: serial("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => auth_user.id, { onDelete: "cascade" }),
		addressId: integer("address_id")
			.notNull()
			.references(() => addresses.id, { onDelete: "cascade" }),
		notificationType: text("notification_type").notNull(),
		hour: integer("hour").notNull(),
		minute: integer("minute").default(0).notNull(),
		enabled: boolean("enabled").default(true).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("notif_prefs_user_id_idx").on(table.userId),
		index("notif_prefs_address_id_idx").on(table.addressId),
	],
);

export const waste_types = pgTable("waste_types", {
	id: serial("id").primaryKey(),
	name: text("name").notNull().unique(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

export const waste_schedules = pgTable(
	"waste_schedules",
	{
		id: serial("id").primaryKey(),
		cityId: integer("city_id")
			.notNull()
			.references(() => cities.id, { onDelete: "cascade" }),
		streetId: integer("street_id")
			.notNull()
			.references(() => streets.id, { onDelete: "cascade" }),
		wasteTypeId: integer("waste_type_id")
			.notNull()
			.references(() => waste_types.id, { onDelete: "cascade" }),
		year: integer("year").notNull(),
		month: text("month").notNull(),
		days: text("days").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("waste_schedules_city_id_idx").on(table.cityId),
		index("waste_schedules_street_id_idx").on(table.streetId),
		index("waste_schedules_waste_type_id_idx").on(table.wasteTypeId),
		index("waste_schedules_year_idx").on(table.year),
	],
);

export const notification_logs = pgTable(
	"notification_logs",
	{
		id: serial("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => auth_user.id, { onDelete: "cascade" }),
		addressId: integer("address_id")
			.notNull()
			.references(() => addresses.id, { onDelete: "cascade" }),
		notificationPreferenceId: integer("notification_preference_id")
			.notNull()
			.references(() => notification_preferences.id),
		wasteTypeIds: text("waste_type_ids").notNull(),
		scheduledDate: text("scheduled_date").notNull(),
		phoneNumber: text("phone_number").notNull(),
		smsContent: text("sms_content").notNull(),
		status: text("status").notNull(),
		serwerSmsMessageId: text("serwer_sms_message_id"),
		serwerSmsStatus: text("serwer_sms_status"),
		messageParts: integer("message_parts"),
		sentAt: timestamp("sent_at"),
		deliveredAt: timestamp("delivered_at"),
		errorMessage: text("error_message"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("notification_logs_user_id_idx").on(table.userId),
		index("notification_logs_address_id_idx").on(table.addressId),
		index("notification_logs_scheduled_date_idx").on(table.scheduledDate),
		index("notification_logs_status_idx").on(table.status),
	],
);
