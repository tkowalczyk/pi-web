import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase } from "drizzle-orm/pg-core";

type DbClient = PgDatabase<any, any, any>;

let db: DbClient | undefined;

export interface ConnectionConfig {
	host: string;
	username: string;
	password: string;
}

export function initDatabase(config: ConnectionConfig): DbClient {
	if (db) {
		return db;
	}
	const connectionString = `postgres://${config.username}:${config.password}@${config.host}`;
	db = drizzle(connectionString) as unknown as DbClient;
	return db;
}

export function getDb(): DbClient {
	if (!db) {
		throw new Error("Database not initialized");
	}
	return db;
}
