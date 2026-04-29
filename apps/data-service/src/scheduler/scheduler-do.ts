import { DurableObject } from "cloudflare:workers";
import {
	type ScheduleConfig,
	type SourceData,
	computeNextScheduledRun,
	renderSourceToPayload,
} from "@/domain/notification";
import { computeNextAlarmForSource } from "@/domain/source-scheduling";
import { TelegramChannel } from "@/channels/telegram";
import type { DeliveryResult, NotificationChannel } from "@repo/data-ops/channels/port";

type SchedulerStatus = "idle" | "scheduled";

interface SchedulerState {
	sourceId: number | null;
	nextAlarmAt: Date | null;
	lastRunAt: Date | null;
	lastRunSuccess: boolean | null;
	status: SchedulerStatus;
}

interface DeliveryTarget {
	channelId: number;
	recipient: string;
	topicId?: number | null;
}

export class SchedulerDO extends DurableObject<Env> {
	channel: NotificationChannel | null = null;

	private resolveChannel(): NotificationChannel | null {
		if (this.channel) return this.channel;
		const botToken = this.env?.TELEGRAM_BOT_TOKEN;
		if (!botToken) return null;
		this.channel = new TelegramChannel({ botToken, fetchFn: fetch.bind(globalThis) });
		return this.channel;
	}

	async getState(): Promise<SchedulerState> {
		const sourceId = await this.ctx.storage.get<number>("sourceId");
		const nextAlarmAt = await this.ctx.storage.get<number>("nextAlarmAt");
		const lastRunAt = await this.ctx.storage.get<number>("lastRunAt");
		const lastRunSuccess = await this.ctx.storage.get<boolean>("lastRunSuccess");

		const status: SchedulerStatus = nextAlarmAt ? "scheduled" : "idle";

		return {
			sourceId: sourceId ?? null,
			nextAlarmAt: nextAlarmAt ? new Date(nextAlarmAt) : null,
			lastRunAt: lastRunAt ? new Date(lastRunAt) : null,
			lastRunSuccess: lastRunSuccess ?? null,
			status,
		};
	}

	async updateSchedule(
		sourceData: SourceData,
		scheduleConfig: ScheduleConfig,
		deliveryTarget: DeliveryTarget,
	): Promise<SchedulerState> {
		const now = new Date();
		const nextRun = computeNextScheduledRun(scheduleConfig, now);

		await this.ctx.storage.put({
			sourceId: sourceData.id,
			sourceData,
			scheduleConfig,
			deliveryTarget,
			nextAlarmAt: nextRun.getTime(),
			scheduleMode: "cron",
			nextScheduledDate: null,
		});
		await this.ctx.storage.setAlarm(nextRun);

		return this.getState();
	}

	async scheduleFromSource(
		sourceData: SourceData,
		alertBeforeHours: number,
		timezone: string,
		deliveryTarget: DeliveryTarget,
	): Promise<SchedulerState> {
		const now = new Date();
		const next = computeNextAlarmForSource(sourceData, alertBeforeHours, timezone, now);

		const baseStorage: Record<string, unknown> = {
			sourceId: sourceData.id,
			sourceData,
			alertBeforeHours,
			timezone,
			deliveryTarget,
			scheduleMode: "dateList",
		};

		if (next) {
			baseStorage.nextAlarmAt = next.alarm.getTime();
			baseStorage.nextScheduledDate = next.scheduledDate;
			await this.ctx.storage.put(baseStorage);
			await this.ctx.storage.setAlarm(next.alarm);
		} else {
			baseStorage.nextAlarmAt = null;
			baseStorage.nextScheduledDate = null;
			await this.ctx.storage.put(baseStorage);
			await this.ctx.storage.deleteAlarm();
		}

		return this.getState();
	}

	async triggerNow(): Promise<DeliveryResult> {
		const sourceData = await this.ctx.storage.get<SourceData>("sourceData");
		const deliveryTarget = await this.ctx.storage.get<DeliveryTarget>("deliveryTarget");
		const alertBeforeHours = await this.ctx.storage.get<number>("alertBeforeHours");
		const timezone = await this.ctx.storage.get<string>("timezone");

		const channel = this.resolveChannel();
		if (!sourceData || !deliveryTarget || !channel) {
			return {
				success: false,
				error: "Missing source data, delivery target, or channel",
				timestamp: new Date(),
			};
		}

		const scheduledDate = resolveScheduledDate(sourceData, alertBeforeHours, timezone, new Date());

		const payload = renderSourceToPayload(sourceData, {
			channelId: deliveryTarget.channelId,
			recipient: deliveryTarget.recipient,
			scheduledDate,
			notificationType: "same_day",
		});

		if (deliveryTarget.topicId) {
			payload.metadata = { message_thread_id: deliveryTarget.topicId };
		}

		const result = await channel.send(payload);

		await this.ctx.storage.put("lastRunSuccess", result.success);
		await this.ctx.storage.put("lastRunAt", Date.now());

		return result;
	}

	async alarm(): Promise<void> {
		const sourceData = await this.ctx.storage.get<SourceData>("sourceData");
		const deliveryTarget = await this.ctx.storage.get<DeliveryTarget>("deliveryTarget");
		const scheduleConfig = await this.ctx.storage.get<ScheduleConfig>("scheduleConfig");
		const scheduleMode = await this.ctx.storage.get<string>("scheduleMode");
		const alertBeforeHours = await this.ctx.storage.get<number>("alertBeforeHours");
		const timezone = await this.ctx.storage.get<string>("timezone");
		const currentAlarmAt = await this.ctx.storage.get<number>("nextAlarmAt");
		const storedScheduledDate = await this.ctx.storage.get<string>("nextScheduledDate");

		const channel = this.resolveChannel();
		if (!sourceData || !deliveryTarget || !channel) {
			await this.ctx.storage.put("lastRunSuccess", false);
			await this.ctx.storage.put("lastRunAt", Date.now());
			return;
		}

		const alarmTime = currentAlarmAt ? new Date(currentAlarmAt) : new Date();
		// New schedules persist nextScheduledDate; legacy storage falls back to
		// the alarm date (pre-fix behavior — corrected on next reschedule).
		const scheduledDate = storedScheduledDate ?? alarmTime.toISOString().slice(0, 10);

		const payload = renderSourceToPayload(sourceData, {
			channelId: deliveryTarget.channelId,
			recipient: deliveryTarget.recipient,
			scheduledDate,
			notificationType: "same_day",
		});

		if (deliveryTarget.topicId) {
			payload.metadata = { message_thread_id: deliveryTarget.topicId };
		}

		const result = await channel.send(payload);

		await this.ctx.storage.put("lastRunSuccess", result.success);
		await this.ctx.storage.put("lastRunAt", Date.now());

		if (scheduleMode === "dateList" && alertBeforeHours !== undefined && timezone) {
			// Use the alarm's local-time as "now" so the next collection date in
			// the list is selected, not the same one we just fired on.
			const reference = new Date(alarmTime.getTime() + 1000);
			const next = computeNextAlarmForSource(sourceData, alertBeforeHours, timezone, reference);
			if (next) {
				await this.ctx.storage.put("nextAlarmAt", next.alarm.getTime());
				await this.ctx.storage.put("nextScheduledDate", next.scheduledDate);
				await this.ctx.storage.setAlarm(next.alarm);
			} else {
				await this.ctx.storage.put("nextAlarmAt", null);
				await this.ctx.storage.put("nextScheduledDate", null);
				await this.ctx.storage.deleteAlarm();
			}
		} else if (scheduleConfig) {
			const nextRun = computeNextScheduledRun(scheduleConfig, alarmTime);
			await this.ctx.storage.put("nextAlarmAt", nextRun.getTime());
			await this.ctx.storage.setAlarm(nextRun);
		}
	}
}

function resolveScheduledDate(
	source: SourceData,
	alertBeforeHours: number | undefined,
	timezone: string | undefined,
	reference: Date,
): string {
	if (alertBeforeHours !== undefined && timezone) {
		const next = computeNextAlarmForSource(source, alertBeforeHours, timezone, reference);
		if (next) return next.scheduledDate;
	}
	return reference.toISOString().slice(0, 10);
}
