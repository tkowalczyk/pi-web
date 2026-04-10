import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDbHandle } from "@repo/test-harness";
import { NoopChannel } from "@repo/test-harness/noop-channel";
import { initDatabase, resetDatabase } from "@/database/setup";
import { households } from "@/drizzle/schema";
import { createNotificationSource, getNotificationSources } from "@/queries/notification-sources";
import { createChannel, getChannels } from "@/queries/channels";

/**
 * Inline render function matching the domain module's behavior.
 * We keep this in data-ops tests to avoid a cross-package import to
 * data-service's domain module, preserving the import boundary.
 */
function renderWastePayload(
	source: { id: number; name: string; config: Record<string, unknown> },
	ctx: {
		channelId: number;
		recipient: string;
		scheduledDate: string;
		notificationType: "day_before" | "same_day";
	},
) {
	const { cityName, streetName, wasteTypes } = source.config as {
		cityName: string;
		streetName: string;
		wasteTypes: string[];
	};
	const typesList = wasteTypes.join(", ");
	const location = `${streetName}, ${cityName}`;
	const body =
		ctx.notificationType === "day_before"
			? `Przypomnienie: Jutro (${ctx.scheduledDate}) wywóz śmieci na ${location}: ${typesList}.`
			: `Dzisiaj (${ctx.scheduledDate}) wywóz śmieci na ${location}: ${typesList}.`;

	return {
		recipient: ctx.recipient,
		subject: source.name,
		body,
		sourceId: source.id,
		channelId: ctx.channelId,
	};
}

describe("Integration: data-ops → domain render → port → noop adapter", () => {
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

	it("queries source from DB, renders payload, sends through noop channel, asserts invocation", async () => {
		// 1. Seed data via data-ops queries
		await createNotificationSource({
			householdId,
			name: "Wywóz śmieci — Wiśniowa",
			type: "waste_collection",
			config: {
				cityName: "Kraków",
				streetName: "ul. Wiśniowa",
				wasteTypes: ["Papier", "Plastik"],
			},
		});

		const channel = await createChannel({
			householdId,
			type: "noop",
			config: {},
		});

		// 2. Query back from DB (proves data-ops round-trip)
		const sources = await getNotificationSources(householdId);
		const channels = await getChannels(householdId);
		expect(sources).toHaveLength(1);
		expect(channels).toHaveLength(1);

		const dbSource = sources[0]!;

		// 3. Domain: render source into notification payload
		const payload = renderWastePayload(
			{
				id: dbSource.id,
				name: dbSource.name,
				config: dbSource.config as Record<string, unknown>,
			},
			{
				channelId: channel.id,
				recipient: "+48123456789",
				scheduledDate: "2026-04-11",
				notificationType: "day_before",
			},
		);

		expect(payload.sourceId).toBe(dbSource.id);
		expect(payload.channelId).toBe(channel.id);
		expect(payload.body).toContain("Papier");
		expect(payload.body).toContain("Jutro");

		// 4. Port: send through NoopChannel
		const noop = new NoopChannel();
		const result = await noop.send(payload);

		expect(result.success).toBe(true);
		expect(result.messageId).toBeDefined();

		// 5. Assert the full slice: recorded invocation matches end-to-end
		expect(noop.invocations).toHaveLength(1);
		const recorded = noop.invocations[0]!;
		expect(recorded.payload.recipient).toBe("+48123456789");
		expect(recorded.payload.body).toContain("Wiśniowa");
		expect(recorded.payload.body).toContain("Plastik");
		expect(recorded.result.success).toBe(true);
	});
});
