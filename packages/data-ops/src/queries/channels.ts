import { getDb } from "@/database/setup";
import { channels } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import type { CreateChannelInput, UpdateChannelInput } from "@/zod-schema/channel";

export async function createChannel(input: CreateChannelInput) {
	const db = getDb();
	const rows = await db.insert(channels).values(input).returning();
	return rows[0] as (typeof rows)[number];
}

export async function getChannels(householdId: number) {
	const db = getDb();
	return await db.select().from(channels).where(eq(channels.householdId, householdId));
}

export async function updateChannel(channelId: number, input: UpdateChannelInput) {
	const db = getDb();
	const [updated] = await db
		.update(channels)
		.set(input)
		.where(eq(channels.id, channelId))
		.returning();
	return updated;
}

export async function deleteChannel(channelId: number) {
	const db = getDb();
	await db.delete(channels).where(eq(channels.id, channelId));
}
