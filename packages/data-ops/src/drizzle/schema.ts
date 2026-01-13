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

export const waste_types = pgTable("waste_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const waste_schedules = pgTable("waste_schedules", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: "cascade" }),
  streetId: integer("street_id").notNull().references(() => streets.id, { onDelete: "cascade" }),
  wasteTypeId: integer("waste_type_id").notNull().references(() => waste_types.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  month: text("month").notNull(),
  days: text("days").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("waste_schedules_city_id_idx").on(table.cityId),
  index("waste_schedules_street_id_idx").on(table.streetId),
  index("waste_schedules_waste_type_id_idx").on(table.wasteTypeId),
  index("waste_schedules_year_idx").on(table.year),
]);

export const notification_logs = pgTable("notification_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => auth_user.id, { onDelete: "cascade" }),
  addressId: integer("address_id").notNull().references(() => addresses.id, { onDelete: "cascade" }),
  notificationPreferenceId: integer("notification_preference_id").notNull().references(() => notification_preferences.id),
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
}, (table) => [
  index("notification_logs_user_id_idx").on(table.userId),
  index("notification_logs_address_id_idx").on(table.addressId),
  index("notification_logs_scheduled_date_idx").on(table.scheduledDate),
  index("notification_logs_status_idx").on(table.status),
]);

export const subscription_plans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  stripeProductId: text("stripe_product_id").notNull().unique(),
  stripePriceId: text("stripe_price_id").notNull().unique(),
  currency: text("currency").notNull().default("PLN"),
  amount: integer("amount").notNull(),
  interval: text("interval").notNull(),
  intervalCount: integer("interval_count").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  paymentMethod: text("payment_method").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("subscription_plans_stripe_product_id_idx").on(table.stripeProductId),
  index("subscription_plans_stripe_price_id_idx").on(table.stripePriceId),
]);

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => auth_user.id, { onDelete: "cascade" }),
  subscriptionPlanId: integer("subscription_plan_id").notNull().references(() => subscription_plans.id, { onDelete: "restrict" }),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull(),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("subscriptions_user_id_idx").on(table.userId),
  index("subscriptions_stripe_customer_id_idx").on(table.stripeCustomerId),
  index("subscriptions_stripe_subscription_id_idx").on(table.stripeSubscriptionId),
  index("subscriptions_stripe_payment_intent_id_idx").on(table.stripePaymentIntentId),
  index("subscriptions_status_idx").on(table.status),
  index("subscriptions_current_period_end_idx").on(table.currentPeriodEnd),
]);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => auth_user.id, { onDelete: "cascade" }),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  stripePaymentIntentId: text("stripe_payment_intent_id").notNull().unique(),
  stripeChargeId: text("stripe_charge_id"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("PLN"),
  status: text("status").notNull(),
  paymentMethod: text("payment_method").notNull(),
  failureCode: text("failure_code"),
  failureMessage: text("failure_message"),
  receiptUrl: text("receipt_url"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("payments_user_id_idx").on(table.userId),
  index("payments_subscription_id_idx").on(table.subscriptionId),
  index("payments_stripe_payment_intent_id_idx").on(table.stripePaymentIntentId),
  index("payments_status_idx").on(table.status),
  index("payments_paid_at_idx").on(table.paidAt),
]);
