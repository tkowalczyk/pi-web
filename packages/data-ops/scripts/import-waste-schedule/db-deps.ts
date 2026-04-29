import { getDb } from "../../src/database/setup";
import { households, notificationSources } from "../../src/drizzle/schema";
import {
	createNotificationSource,
	updateNotificationSource,
} from "../../src/queries/notification-sources";
import { and, eq, sql } from "drizzle-orm";
import type { ImporterDeps, SourceRow } from "./importer";

interface DbDepsExternal {
	readFile: (path: string) => Promise<string>;
	createForumTopic: (name: string) => Promise<number | null>;
	reschedule: (sourceId: number) => Promise<void>;
	log: (line: string) => void;
}

export function buildDbDeps(external: DbDepsExternal): ImporterDeps {
	return {
		readFile: external.readFile,

		async findHouseholds() {
			const db = getDb();
			return await db.select({ id: households.id }).from(households);
		},

		async findExistingSource({ householdId, type, address }) {
			const db = getDb();
			const rows = await db
				.select()
				.from(notificationSources)
				.where(
					and(
						eq(notificationSources.householdId, householdId),
						eq(notificationSources.type, type),
						sql`${notificationSources.config}->>'address' = ${address}`,
					),
				)
				.limit(1);
			const row = rows[0];
			if (!row) return null;
			return {
				id: row.id,
				name: row.name,
				type: row.type,
				config: row.config as Record<string, unknown>,
				topicId: row.topicId,
			};
		},

		async insertSource(input): Promise<SourceRow> {
			const row = await createNotificationSource(input);
			return {
				id: row.id,
				name: row.name,
				type: row.type,
				config: row.config as Record<string, unknown>,
				topicId: row.topicId,
			};
		},

		async updateSource(sourceId, patch) {
			return updateNotificationSource(sourceId, patch);
		},

		createForumTopic: external.createForumTopic,
		reschedule: external.reschedule,
		log: external.log,
	};
}
