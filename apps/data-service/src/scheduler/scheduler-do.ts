import { DurableObject } from "cloudflare:workers";
import {
	type ScheduleConfig,
	type SourceData,
	computeNextScheduledRun,
	renderSourceToPayload,
} from "@/domain/notification";
import type { DeliveryResult, NotificationChannel } from "@repo/data-ops/channels/port";
import { TelegramChannel } from "@/channels/telegram";

export type SchedulerStatus = "idle" | "scheduled";

export interface SchedulerState {
	sourceId: number | null;
	nextAlarmAt: Date | null;
	lastRunAt: Date | null;
	lastRunSuccess: boolean | null;
	status: SchedulerStatus;
}

export interface DeliveryTarget {
	channelId: number;
	recipient: string;
}

export class SchedulerDO extends DurableObject<Env> {
	channel: NotificationChannel | null = null;

	private getChannel(): NotificationChannel | null {
		if (this.channel) return this.channel;
		const botToken = this.env?.TELEGRAM_BOT_TOKEN;
		if (botToken) {
			this.channel = new TelegramChannel({ botToken });
			return this.channel;
		}
		return null;
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
		});
		await this.ctx.storage.setAlarm(nextRun);

		return this.getState();
	}

	async triggerNow(): Promise<DeliveryResult> {
		const sourceData = await this.ctx.storage.get<SourceData>("sourceData");
		const deliveryTarget = await this.ctx.storage.get<DeliveryTarget>("deliveryTarget");
		const channel = this.getChannel();

		if (!sourceData || !deliveryTarget || !channel) {
			return {
				success: false,
				error: "Missing source data, delivery target, or channel",
				timestamp: new Date(),
			};
		}

		const payload = renderSourceToPayload(sourceData, {
			channelId: deliveryTarget.channelId,
			recipient: deliveryTarget.recipient,
			scheduledDate: new Date().toISOString().slice(0, 10),
			notificationType: "same_day",
		});

		const result = await channel.send(payload);

		await this.ctx.storage.put("lastRunSuccess", result.success);
		await this.ctx.storage.put("lastRunAt", Date.now());

		return result;
	}

	async alarm(): Promise<void> {
		const sourceData = await this.ctx.storage.get<SourceData>("sourceData");
		const deliveryTarget = await this.ctx.storage.get<DeliveryTarget>("deliveryTarget");
		const scheduleConfig = await this.ctx.storage.get<ScheduleConfig>("scheduleConfig");
		const currentAlarmAt = await this.ctx.storage.get<number>("nextAlarmAt");
		const channel = this.getChannel();

		if (!sourceData || !deliveryTarget || !channel) {
			await this.ctx.storage.put("lastRunSuccess", false);
			await this.ctx.storage.put("lastRunAt", Date.now());
			return;
		}

		const alarmTime = currentAlarmAt ? new Date(currentAlarmAt) : new Date();

		const payload = renderSourceToPayload(sourceData, {
			channelId: deliveryTarget.channelId,
			recipient: deliveryTarget.recipient,
			scheduledDate: alarmTime.toISOString().slice(0, 10),
			notificationType: "same_day",
		});

		const result = await channel.send(payload);

		await this.ctx.storage.put("lastRunSuccess", result.success);
		await this.ctx.storage.put("lastRunAt", Date.now());

		if (scheduleConfig) {
			const nextRun = computeNextScheduledRun(scheduleConfig, alarmTime);
			await this.ctx.storage.put("nextAlarmAt", nextRun.getTime());
			await this.ctx.storage.setAlarm(nextRun);
		}
	}
}
