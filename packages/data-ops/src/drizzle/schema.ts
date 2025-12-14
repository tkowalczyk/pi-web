import { pgTable, serial, text, timestamp, boolean, integer, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { auth_user } from "./auth-schema"

export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const streets = pgTable("streets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("streets_city_id_idx").on(table.cityId),
]);

export const addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => auth_user.id, { onDelete: "cascade" }),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: "restrict" }),
  streetId: integer("street_id").notNull().references(() => streets.id, { onDelete: "restrict" }),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("addresses_user_id_idx").on(table.userId),
  index("addresses_city_id_idx").on(table.cityId),
]);

export const notification_preferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => auth_user.id, { onDelete: "cascade" }),
  addressId: integer("address_id").notNull().references(() => addresses.id, { onDelete: "cascade" }),
  notificationType: text("notification_type").notNull(),
  hour: integer("hour").notNull(),
  minute: integer("minute").default(0).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("notif_prefs_user_id_idx").on(table.userId),
  index("notif_prefs_address_id_idx").on(table.addressId),
]);




