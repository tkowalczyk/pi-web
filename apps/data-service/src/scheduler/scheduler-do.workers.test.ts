import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { ScheduleConfig, SourceData } from "@/domain/notification";
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
