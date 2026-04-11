import { relations } from "drizzle-orm/relations";
import {
	households,
	householdMembers,
	householdRoles,
	channels,
	notificationSources,
	deliveryLog,
	deliveryFailures,
} from "./schema";
import { auth_user } from "./auth-schema";

export const householdsRelations = relations(households, ({ many }) => ({
	members: many(householdMembers),
	channels: many(channels),
	notificationSources: many(notificationSources),
}));

export const householdMembersRelations = relations(householdMembers, ({ one }) => ({
	household: one(households, {
		fields: [householdMembers.householdId],
		references: [households.id],
	}),
	user: one(auth_user, {
		fields: [householdMembers.userId],
		references: [auth_user.id],
	}),
	role: one(householdRoles, {
		fields: [householdMembers.roleId],
		references: [householdRoles.id],
	}),
}));

export const householdRolesRelations = relations(householdRoles, ({ many }) => ({
	members: many(householdMembers),
}));

export const channelsRelations = relations(channels, ({ one }) => ({
	household: one(households, {
		fields: [channels.householdId],
		references: [households.id],
	}),
}));

export const notificationSourcesRelations = relations(notificationSources, ({ one, many }) => ({
	household: one(households, {
		fields: [notificationSources.householdId],
		references: [households.id],
	}),
	deliveryLogs: many(deliveryLog),
	deliveryFailures: many(deliveryFailures),
}));

export const deliveryLogRelations = relations(deliveryLog, ({ one }) => ({
	source: one(notificationSources, {
		fields: [deliveryLog.sourceId],
		references: [notificationSources.id],
	}),
}));

export const deliveryFailuresRelations = relations(deliveryFailures, ({ one }) => ({
	source: one(notificationSources, {
		fields: [deliveryFailures.sourceId],
		references: [notificationSources.id],
	}),
}));
