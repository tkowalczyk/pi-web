import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { ScheduleConfig, SourceData } from "@/domain/notification";
import type { WasteCollectionConfig } from "@/domain/waste-collection-handler";
import { NoopChannel } from "@repo/test-harness/noop-channel";
import type { SchedulerDO } from "./scheduler-do";

const dailyAt8: ScheduleConfig = {
	frequency: "daily",
	hour: 8,
	minute: 0,
};

const syntheticSource: SourceData = {
	id: 1,
	name: "Test source",
	type: "generic",
	config: { message: "Test notification" },
};

const deliveryTarget = {
	channelId: 10,
	recipient: "+48123456789",
};

const wasteConfig: WasteCollectionConfig = {
	address: "ul. Kwiatowa 5",
	schedule: [
		{ type: "szkło", dates: ["2026-04-15", "2026-04-29"] },
		{ type: "papier", dates: ["2026-04-20"] },
	],
};

const wasteSource: SourceData = {
	id: 42,
	name: "Wywóz śmieci — Kwiatowa",
	type: "waste_collection",
	config: wasteConfig as unknown as Record<string, unknown>,
};

describe("SchedulerDO", () => {
	it("returns empty state for a new instance", async () => {
		const id = env.SCHEDULER.idFromName("test-new");
		const stub = env.SCHEDULER.get(id);

		const state = await stub.getState();

		expect(state).toEqual({
			sourceId: null,
			nextAlarmAt: null,
			lastRunAt: null,
			lastRunSuccess: null,
			status: "idle",
		});
	});

	it("sets alarm after updateSchedule", async () => {
		const id = env.SCHEDULER.idFromName("test-update");
		const stub = env.SCHEDULER.get(id);

		const state = await stub.updateSchedule(syntheticSource, dailyAt8, deliveryTarget);

		expect(state.sourceId).toBe(1);
		expect(state.nextAlarmAt).not.toBeNull();
	});

	it("alarm fires and invokes channel", async () => {
		const id = env.SCHEDULER.idFromName("test-alarm");
		const stub = env.SCHEDULER.get(id);

		const noop = new NoopChannel();

		await runInDurableObject(stub, async (instance: SchedulerDO) => {
			instance.channel = noop;
		});

		await stub.updateSchedule(syntheticSource, dailyAt8, deliveryTarget);

		const ran = await runDurableObjectAlarm(stub);
		expect(ran).toBe(true);

		await runInDurableObject(stub, async (instance: SchedulerDO) => {
			const ch = instance.channel as NoopChannel;
			expect(ch.invocations).toHaveLength(1);
			expect(ch.invocations[0]?.payload.recipient).toBe("+48123456789");
			expect(ch.invocations[0]?.payload.sourceId).toBe(1);
		});

		const state = await stub.getState();
		expect(state.lastRunSuccess).toBe(true);
		expect(state.lastRunAt).not.toBeNull();
	});

	it("triggerNow delivers immediately without changing scheduled alarm", async () => {
		const id = env.SCHEDULER.idFromName("test-trigger");
		const stub = env.SCHEDULER.get(id);

		const noop = new NoopChannel();
		await runInDurableObject(stub, async (instance: SchedulerDO) => {
			instance.channel = noop;
		});

		await stub.updateSchedule(syntheticSource, dailyAt8, deliveryTarget);
		const stateBeforeTrigger = await stub.getState();

		const result = await stub.triggerNow();

		expect(result.success).toBe(true);

		await runInDurableObject(stub, async (instance: SchedulerDO) => {
			const ch = instance.channel as NoopChannel;
			expect(ch.invocations).toHaveLength(1);
		});

		const stateAfter = await stub.getState();
		expect(stateAfter.nextAlarmAt?.getTime()).toBe(stateBeforeTrigger.nextAlarmAt?.getTime());
	});

	it("alarm fires waste collection pipeline: render → send → next alarm", async () => {
		const id = env.SCHEDULER.idFromName("test-waste-alarm");
		const stub = env.SCHEDULER.get(id);

		const noop = new NoopChannel();
		await runInDurableObject(stub, async (instance: SchedulerDO) => {
			instance.channel = noop;
		});

		await stub.updateSchedule(wasteSource, dailyAt8, deliveryTarget);

		const ran = await runDurableObjectAlarm(stub);
		expect(ran).toBe(true);

		await runInDurableObject(stub, async (instance: SchedulerDO) => {
			const ch = instance.channel as NoopChannel;
			expect(ch.invocations).toHaveLength(1);

			const payload = ch.invocations[0]!.payload;
			expect(payload.sourceId).toBe(42);
			expect(payload.recipient).toBe("+48123456789");
			// Body should contain waste collection content (HTML with emoji)
			expect(payload.body).toContain("🗑");
			expect(payload.body).toContain("Kwiatowa");
		});

		const state = await stub.getState();
		expect(state.lastRunSuccess).toBe(true);
		expect(state.nextAlarmAt).not.toBeNull();
	});

	it("getState returns status 'idle' before schedule, 'scheduled' after, and updates after alarm", async () => {
		const id = env.SCHEDULER.idFromName("test-gestate-status");
		const stub = env.SCHEDULER.get(id);

		const initial = await stub.getState();
		expect(initial.status).toBe("idle");

		const noop = new NoopChannel();
		await runInDurableObject(stub, async (instance: SchedulerDO) => {
			instance.channel = noop;
		});

		await stub.updateSchedule(syntheticSource, dailyAt8, deliveryTarget);
		const scheduled = await stub.getState();
		expect(scheduled.status).toBe("scheduled");

		await runDurableObjectAlarm(stub);
		const afterAlarm = await stub.getState();
		expect(afterAlarm.status).toBe("scheduled");
		expect(afterAlarm.lastRunAt).not.toBeNull();
		expect(afterAlarm.lastRunSuccess).toBe(true);
	});

	it("alarm fires birthday pipeline: render → send → next alarm", async () => {
		const birthdaySource: SourceData = {
			id: 77,
			name: "Urodziny rodziny",
			type: "birthday",
			config: {
				birthdays: [
					{ name: "Mama", date: "03-15" },
					{ name: "Tata", date: "11-02" },
				],
			} as unknown as Record<string, unknown>,
		};

		const id = env.SCHEDULER.idFromName("test-birthday-alarm");
		const stub = env.SCHEDULER.get(id);

		const noop = new NoopChannel();
		await runInDurableObject(stub, async (instance: SchedulerDO) => {
			instance.channel = noop;
		});

		await stub.updateSchedule(birthdaySource, dailyAt8, deliveryTarget);

		const ran = await runDurableObjectAlarm(stub);
		expect(ran).toBe(true);

		await runInDurableObject(stub, async (instance: SchedulerDO) => {
			const ch = instance.channel as NoopChannel;
			expect(ch.invocations).toHaveLength(1);

			const payload = ch.invocations[0]!.payload;
			expect(payload.sourceId).toBe(77);
			expect(payload.recipient).toBe("+48123456789");
			expect(payload.body).toContain("🎂");
		});

		const state = await stub.getState();
		expect(state.lastRunSuccess).toBe(true);
		expect(state.nextAlarmAt).not.toBeNull();
	});

	it("scheduleFromSource (waste): sets alarm computed via date-list + alertBeforeHours + timezone", async () => {
		const id = env.SCHEDULER.idFromName("test-schedule-from-source-waste");
		const stub = env.SCHEDULER.get(id);

		// Future date well past test run time. Local midnight 2030-04-30 in
		// Europe/Warsaw (CEST, UTC+2) = 2030-04-29T22:00:00Z. Minus 18h = 2030-04-29T04:00:00Z.
		const wasteWith2030: SourceData = {
			id: 200,
			name: "Wywóz 2030",
			type: "waste_collection",
			config: {
				address: "ul. Z",
				schedule: [{ type: "metalsAndPlastics", dates: ["2030-04-30"] }],
			} as unknown as Record<string, unknown>,
		};

		const state = await stub.scheduleFromSource(wasteWith2030, 18, "Europe/Warsaw", deliveryTarget);

		expect(state.sourceId).toBe(200);
		expect(state.nextAlarmAt?.toISOString()).toBe("2030-04-29T04:00:00.000Z");
	});

	it("alarm reschedules waste source via date-list and renders the collection date (not the alarm date)", async () => {
		const id = env.SCHEDULER.idFromName("test-alarm-waste-datelist");
		const stub = env.SCHEDULER.get(id);

		const noop = new NoopChannel();
		await runInDurableObject(stub, async (instance: SchedulerDO) => {
			instance.channel = noop;
		});

		// Two future dates so the post-alarm reschedule has a next one.
		const wasteWithTwoDates: SourceData = {
			id: 201,
			name: "Wywóz dwa terminy",
			type: "waste_collection",
			config: {
				address: "ul. Q",
				schedule: [{ type: "mixed", dates: ["2030-04-30", "2030-05-15"] }],
			} as unknown as Record<string, unknown>,
		};

		await stub.scheduleFromSource(wasteWithTwoDates, 18, "Europe/Warsaw", deliveryTarget);
		const initialState = await stub.getState();
		expect(initialState.nextAlarmAt?.toISOString()).toBe("2030-04-29T04:00:00.000Z");

		await runDurableObjectAlarm(stub);

		await runInDurableObject(stub, async (instance: SchedulerDO) => {
			const ch = instance.channel as NoopChannel;
			expect(ch.invocations).toHaveLength(1);
			const body = ch.invocations[0]!.payload.body;
			// Body must reference the collection day (2030-04-30 = "30 kwietnia 2030") and
			// the waste type — both come from the persisted nextScheduledDate, not the alarm
			// fire date (which would be 2030-04-29).
			expect(body).toContain("30 kwietnia 2030");
			expect(body).toContain("zmieszane");
		});

		const afterAlarm = await stub.getState();
		expect(afterAlarm.lastRunSuccess).toBe(true);
		// Next alarm should advance to the next collection date (2030-05-15).
		expect(afterAlarm.nextAlarmAt?.toISOString()).toBe("2030-05-14T04:00:00.000Z");
	});

	it("alarm sets payload.metadata.message_thread_id from deliveryTarget.topicId", async () => {
		const id = env.SCHEDULER.idFromName("test-alarm-topic-id");
		const stub = env.SCHEDULER.get(id);

		const noop = new NoopChannel();
		await runInDurableObject(stub, async (instance: SchedulerDO) => {
			instance.channel = noop;
		});

		const wasteWithTopic: SourceData = {
			id: 202,
			name: "Wywóz z topikiem",
			type: "waste_collection",
			config: {
				address: "ul. R",
				schedule: [{ type: "paper", dates: ["2030-06-10"] }],
			} as unknown as Record<string, unknown>,
		};

		await stub.scheduleFromSource(wasteWithTopic, 18, "Europe/Warsaw", {
			channelId: 0,
			recipient: "-100123",
			topicId: 5555,
		});

		await runDurableObjectAlarm(stub);

		await runInDurableObject(stub, async (instance: SchedulerDO) => {
			const ch = instance.channel as NoopChannel;
			expect(ch.invocations).toHaveLength(1);
			expect(ch.invocations[0]!.payload.metadata).toEqual({ message_thread_id: 5555 });
		});
	});

	it("alarm without topicId leaves payload.metadata unset (defaults to General)", async () => {
		const id = env.SCHEDULER.idFromName("test-alarm-no-topic");
		const stub = env.SCHEDULER.get(id);

		const noop = new NoopChannel();
		await runInDurableObject(stub, async (instance: SchedulerDO) => {
			instance.channel = noop;
		});

		const wasteNoTopic: SourceData = {
			id: 203,
			name: "Wywóz bez topica",
			type: "waste_collection",
			config: {
				address: "ul. S",
				schedule: [{ type: "mixed", dates: ["2030-07-01"] }],
			} as unknown as Record<string, unknown>,
		};

		await stub.scheduleFromSource(wasteNoTopic, 18, "Europe/Warsaw", {
			channelId: 0,
			recipient: "-100123",
			topicId: null,
		});

		await runDurableObjectAlarm(stub);

		await runInDurableObject(stub, async (instance: SchedulerDO) => {
			const ch = instance.channel as NoopChannel;
			expect(ch.invocations).toHaveLength(1);
			expect(ch.invocations[0]!.payload.metadata).toBeUndefined();
		});
	});

	it("alarm reschedules the next run after firing", async () => {
		const id = env.SCHEDULER.idFromName("test-reschedule");
		const stub = env.SCHEDULER.get(id);

		const noop = new NoopChannel();
		await runInDurableObject(stub, async (instance: SchedulerDO) => {
			instance.channel = noop;
		});

		await stub.updateSchedule(syntheticSource, dailyAt8, deliveryTarget);
		const firstState = await stub.getState();
		const firstAlarmTime = firstState.nextAlarmAt?.getTime();
		expect(firstAlarmTime).toBeDefined();

		await runDurableObjectAlarm(stub);

		const stateAfterAlarm = await stub.getState();
		expect(stateAfterAlarm.nextAlarmAt).not.toBeNull();
		expect(stateAfterAlarm.nextAlarmAt?.getTime()).toBeGreaterThan(firstAlarmTime as number);
	});
});
