// packages/data-ops/database/setup.ts
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase } from "drizzle-orm/pg-core";

/**
 * The shared DB slot. Intentionally typed as the common `PgDatabase` base so
 * both the production Neon HTTP client and test-harness PGLite clients can
 * satisfy it. Runtime query-builder behavior is identical for the calls we
 * make in this package.
 */
type DbClient = PgDatabase<any, any, any>;

let db: DbClient | undefined;

export interface ConnectionConfig {
	host: string;
	username: string;
	password: string;
}

/**
 * Two shapes:
 *   initDatabase({ host, username, password }) → production/Neon path
 *   initDatabase({ client })                   → test-injection path
 *
 * Both are idempotent — a second call after the slot is populated is a no-op
 * and returns the existing client. Use `resetDatabase()` in tests to force
 * re-initialization.
 */
export function initDatabase(config: ConnectionConfig): DbClient;
export function initDatabase(config: { client: DbClient }): DbClient;
export function initDatabase(config: ConnectionConfig | { client: DbClient }): DbClient {
	if (db) {
		return db;
	}
	if ("client" in config) {
		db = config.client;
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

/**
 * Clears the module-level DB slot. Tests call this between runs so each test
 * can install a fresh in-memory database without cross-contamination.
 */
export function resetDatabase(): void {
	db = undefined;
}
