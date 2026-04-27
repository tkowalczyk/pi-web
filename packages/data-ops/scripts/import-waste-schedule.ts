/**
 * Imports a raw waste collection schedule JSON file into a `notification_source`
 * row of type `waste_collection`.
 *
 * Usage:
 *   pnpm import:waste:dev   --file <path> [--household-id <id>] [--address "<label>"] \
 *                           [--year <YYYY>] [--scheduler-url <url>] [--dry-run]
 *   pnpm import:waste:stage --file ...
 *   pnpm import:waste:prod  --file ...
 *
 * See `packages/data-ops/CLAUDE.md` and GitHub issue #28 for the full contract.
 */
import { readFile } from "node:fs/promises";
import { initDatabase } from "../src/database/setup";
import { parseImportArgs } from "./import-waste-schedule/parse-args";
import { runImport } from "./import-waste-schedule/importer";
import { buildDbDeps } from "./import-waste-schedule/db-deps";

async function main() {
	const opts = parseImportArgs(process.argv.slice(2));

	if (!opts.dryRun) {
		const host = required("DATABASE_HOST");
		const username = required("DATABASE_USERNAME");
		const password = required("DATABASE_PASSWORD");
		initDatabase({ host, username, password });
	} else {
		const host = process.env.DATABASE_HOST;
		const username = process.env.DATABASE_USERNAME;
		const password = process.env.DATABASE_PASSWORD;
		if (host && username && password) {
			initDatabase({ host, username, password });
		}
	}

	const botToken = process.env.TELEGRAM_BOT_TOKEN;
	const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;

	const deps = buildDbDeps({
		readFile: (path) => readFile(path, "utf-8"),
		createForumTopic: async (name) => {
			if (!botToken || !chatId) {
				console.warn(
					"  ⚠ TELEGRAM_BOT_TOKEN / TELEGRAM_GROUP_CHAT_ID not set — skipping topic creation",
				);
				return null;
			}
			const url = `https://api.telegram.org/bot${botToken}/createForumTopic`;
			const res = await fetch(url, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ chat_id: chatId, name }),
			});
			if (!res.ok) {
				console.warn(`  ⚠ createForumTopic failed: ${res.status} ${await res.text()}`);
				return null;
			}
			const json = (await res.json()) as { result?: { message_thread_id?: number } };
			return json.result?.message_thread_id ?? null;
		},
		reschedule: async (sourceId) => {
			if (!opts.schedulerUrl) return;
			const url = `${opts.schedulerUrl.replace(/\/$/, "")}/sources/${sourceId}/reschedule`;
			const res = await fetch(url, { method: "POST" });
			if (!res.ok) {
				console.warn(`  ⚠ reschedule POST ${url} failed: ${res.status}`);
			}
		},
		log: (line) => console.log(line),
	});

	const summary = await runImport(opts, deps);
	console.log("\n✓ Done:", JSON.stringify(summary, null, 2));
}

function required(name: string): string {
	const v = process.env[name];
	if (!v) throw new Error(`Missing env var ${name}`);
	return v;
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error("\n✗ Import failed:", e instanceof Error ? e.message : e);
		process.exit(1);
	});
