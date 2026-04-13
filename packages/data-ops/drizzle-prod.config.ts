import type { Config } from "drizzle-kit";

const url =
	process.env.DATABASE_URL ??
	`postgresql://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}`;

const config: Config = {
	out: "./src/drizzle/migrations/prod",
	schema: ["./src/drizzle/auth-schema.ts", "./src/drizzle/schema.ts", "./src/drizzle/relations.ts"],
	dialect: "postgresql",
	dbCredentials: { url },
	tablesFilter: ["!_cf_KV", "!auth_*"],
};

export default config satisfies Config;
