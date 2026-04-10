import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDbHandle } from "@repo/test-harness";
import { initDatabase, resetDatabase } from "@/database/setup";
import { households } from "@/drizzle/schema";
import {
	createChannel,
	getChannels,
	updateChannel,
	deleteChannel,
} from "@/queries/channels";
import { ChannelResponse } from "@/zod-schema/channel";

describe("channels CRUD (data-ops ↔ test-harness)", () => {
	let handle: TestDbHandle;
	let householdId: number;

	beforeEach(async () => {
		handle = await createTestDb();
		resetDatabase();
		initDatabase({ client: handle.db });

		const [h] = await handle.db.select().from(households);
		householdId = h!.id;
	});

	afterEach(async () => {
		resetDatabase();
		await handle.cleanup();
	});

	it("creates a channel with type and config", async () => {
		const channel = await createChannel({
			householdId,
			type: "telegram",
			config: { botToken: "abc", chatId: "123" },
		});

		expect(channel.type).toBe("telegram");
		expect(channel.config).toEqual({ botToken: "abc", chatId: "123" });
		expect(channel.enabled).toBe(true);

		const parsed = ChannelResponse.parse(channel);
		expect(parsed.id).toBe(channel.id);
	});

	it("getChannels lists all channels for a household", async () => {
		await createChannel({ householdId, type: "telegram", config: {} });
		await createChannel({ householdId, type: "sms", config: {} });

		const channels = await getChannels(householdId);
		expect(channels).toHaveLength(2);
	});

	it("updateChannel modifies type and config", async () => {
		const channel = await createChannel({ householdId, type: "telegram", config: {} });

		const updated = await updateChannel(channel.id, {
			config: { botToken: "new" },
			enabled: false,
		});

		expect(updated!.config).toEqual({ botToken: "new" });
		expect(updated!.enabled).toBe(false);
	});

	it("deleteChannel removes the channel", async () => {
		const channel = await createChannel({ householdId, type: "telegram", config: {} });

		await deleteChannel(channel.id);

		const channels = await getChannels(householdId);
		expect(channels).toHaveLength(0);
	});
});
