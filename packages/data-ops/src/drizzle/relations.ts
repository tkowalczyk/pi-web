import { relations } from "drizzle-orm/relations";
import { addresses, notification_preferences, cities, streets, waste_types, waste_schedules } from "./schema";
import { auth_user } from "./auth-schema";

export const citiesRelations = relations(cities, ({ many }) => ({
  streets: many(streets),
  addresses: many(addresses),
  wasteSchedules: many(waste_schedules),
}));

export const streetsRelations = relations(streets, ({ one, many }) => ({
  city: one(cities, {
    fields: [streets.cityId],
    references: [cities.id],
  }),
  addresses: many(addresses),
}));

export const addressesRelations = relations(addresses, ({ one, many }) => ({
  user: one(auth_user, {
    fields: [addresses.userId],
    references: [auth_user.id],
  }),
  city: one(cities, {
    fields: [addresses.cityId],
    references: [cities.id],
  }),
  street: one(streets, {
    fields: [addresses.streetId],
    references: [streets.id],
  }),
  notificationPreferences: many(notification_preferences),
}));

export const notificationPreferencesRelations = relations(notification_preferences, ({ one }) => ({
  user: one(auth_user, {
    fields: [notification_preferences.userId],
    references: [auth_user.id],
  }),
  address: one(addresses, {
    fields: [notification_preferences.addressId],
    references: [addresses.id],
  }),
}));

export const wasteTypesRelations = relations(waste_types, ({ many }) => ({
  schedules: many(waste_schedules),
}));

export const wasteSchedulesRelations = relations(waste_schedules, ({ one }) => ({
  city: one(cities, {
    fields: [waste_schedules.cityId],
    references: [cities.id],
  }),
  wasteType: one(waste_types, {
    fields: [waste_schedules.wasteTypeId],
    references: [waste_types.id],
  }),
}));

