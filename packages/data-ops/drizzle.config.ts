// packages/data-ops/drizzle.config.ts
import type { Config } from "drizzle-kit";
const config: Config = {
  out: "./src/drizzle",
  schema: ["./src/drizzle/auth-schema.ts"],
  dialect: "postgresql",
  dbCredentials: {
    url: `postgresql://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}`,
  },
  tablesFilter: ["!_cf_KV", "!auth_*"],
};

export default config satisfies Config;