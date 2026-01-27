import { initDatabase } from "./setup";
import { debugUserNotifications } from "../queries/debug-notifications";

async function main() {
  const userIdOrEmail = process.argv[2];

  if (!userIdOrEmail) {
    console.error("Usage: pnpm debug:notifications:dev <user-id-or-email>");
    process.exit(1);
  }

  const host = process.env.DATABASE_HOST;
  const username = process.env.DATABASE_USERNAME;
  const password = process.env.DATABASE_PASSWORD;

  if (!host || !username || !password) {
    console.error("Missing DATABASE_HOST, DATABASE_USERNAME, or DATABASE_PASSWORD");
    process.exit(1);
  }

  initDatabase({ host, username, password });

  const result = await debugUserNotifications(userIdOrEmail);

  console.log("\n=== NOTIFICATION DEBUG ===\n");
  console.log(JSON.stringify(result, null, 2));

  if (result.issues && result.issues.length > 0) {
    console.log("\n=== ISSUES FOUND ===\n");
    for (const issue of result.issues) {
      console.log(`  - ${issue}`);
    }
  } else if (!("error" in result)) {
    console.log("\n=== NO ISSUES - User should receive notifications ===\n");
  }
}

main().catch(console.error);
