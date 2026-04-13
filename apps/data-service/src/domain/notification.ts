import type { NotificationPayload } from "@repo/data-ops/channels/port";
import { renderMessage as renderBirthdayMessage, type BirthdayEntry } from "./birthday-handler";
import { renderMessage, type WasteCollectionConfig } from "./waste-collection-handler";

// ─── Schedule types ────────────────────────────────────────────────

export interface DailySchedule {
	frequency: "daily";
	hour: number;
	minute: number;
}

export interface WeeklySchedule {
	frequency: "weekly";
	hour: number;
	minute: number;
	/** 0 = Sunday, 1 = Monday, …, 6 = Saturday */
	dayOfWeek: number;
}

export type ScheduleConfig = DailySchedule | WeeklySchedule;

// ─── Source types ──────────────────────────────────────────────────

export interface SourceData {
	id: number;
	name: string;
	type: string;
	config: Record<string, unknown>;
}

export interface RenderContext {
	channelId: number;
	recipient: string;
	scheduledDate: string;
	notificationType: "day_before" | "same_day";
}

// ─── computeNextScheduledRun ───────────────────────────────────────

export function computeNextScheduledRun(config: ScheduleConfig, now: Date): Date {
	if (config.frequency === "daily") {
		return computeDaily(config, now);
	}
	return computeWeekly(config, now);
}

function computeDaily(config: DailySchedule, now: Date): Date {
	const candidate = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate(),
			config.hour,
			config.minute,
			0,
			0,
		),
	);

	if (candidate.getTime() <= now.getTime()) {
		candidate.setUTCDate(candidate.getUTCDate() + 1);
	}

	return candidate;
}

function computeWeekly(config: WeeklySchedule, now: Date): Date {
	const todayDow = now.getUTCDay();
	let daysUntil = config.dayOfWeek - todayDow;
	if (daysUntil < 0) daysUntil += 7;

	const candidate = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate() + daysUntil,
			config.hour,
			config.minute,
			0,
			0,
		),
	);

	if (candidate.getTime() <= now.getTime()) {
		candidate.setUTCDate(candidate.getUTCDate() + 7);
	}

	return candidate;
}

// ─── renderSourceToPayload ─────────────────────────────────────────

export function renderSourceToPayload(source: SourceData, ctx: RenderContext): NotificationPayload {
	if (source.type === "waste_collection") {
		return renderWasteCollection(source, ctx);
	}
	if (source.type === "birthday") {
		return renderBirthday(source, ctx);
	}
	return renderGeneric(source, ctx);
}

function renderWasteCollection(source: SourceData, ctx: RenderContext): NotificationPayload {
	const config = source.config as unknown as WasteCollectionConfig;
	const body = renderMessage(config, ctx.scheduledDate);

	return {
		recipient: ctx.recipient,
		subject: source.name,
		body,
		sourceId: source.id,
		channelId: ctx.channelId,
	};
}

function renderBirthday(source: SourceData, ctx: RenderContext): NotificationPayload {
	const config = source.config as unknown as { birthdays: BirthdayEntry[] };
	const scheduledMd = ctx.scheduledDate.slice(5); // "YYYY-MM-DD" → "MM-DD"
	const match = config.birthdays.find((b) => b.date === scheduledMd);
	const birthdayName = match?.name ?? source.name;
	const body = renderBirthdayMessage(config, birthdayName);

	return {
		recipient: ctx.recipient,
		subject: source.name,
		body,
		sourceId: source.id,
		channelId: ctx.channelId,
	};
}

function renderGeneric(source: SourceData, ctx: RenderContext): NotificationPayload {
	const message = (source.config as { message?: string }).message ?? source.name;

	return {
		recipient: ctx.recipient,
		subject: source.name,
		body: message,
		sourceId: source.id,
		channelId: ctx.channelId,
	};
}
