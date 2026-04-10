import { describe, it, expect } from "vitest";
import {
	computeNextScheduledRun,
	renderSourceToPayload,
	type ScheduleConfig,
	type SourceData,
} from "./notification";

describe("computeNextScheduledRun", () => {
	it("returns the next occurrence for a daily schedule", () => {
		const config: ScheduleConfig = {
			frequency: "daily",
			hour: 8,
			minute: 0,
		};
		// Now is 2026-04-10 at 07:00 UTC — next run should be today at 08:00
		const now = new Date("2026-04-10T07:00:00Z");
		const next = computeNextScheduledRun(config, now);
		expect(next).toEqual(new Date("2026-04-10T08:00:00Z"));
	});

	it("rolls to tomorrow when today's time has passed", () => {
		const config: ScheduleConfig = {
			frequency: "daily",
			hour: 8,
			minute: 0,
		};
		// Now is 2026-04-10 at 09:00 UTC — next run should be tomorrow 08:00
		const now = new Date("2026-04-10T09:00:00Z");
		const next = computeNextScheduledRun(config, now);
		expect(next).toEqual(new Date("2026-04-11T08:00:00Z"));
	});

	it("handles exact current time by rolling to tomorrow", () => {
		const config: ScheduleConfig = {
			frequency: "daily",
			hour: 8,
			minute: 0,
		};
		const now = new Date("2026-04-10T08:00:00Z");
		const next = computeNextScheduledRun(config, now);
		expect(next).toEqual(new Date("2026-04-11T08:00:00Z"));
	});

	it("returns the next matching weekday for a weekly schedule", () => {
		const config: ScheduleConfig = {
			frequency: "weekly",
			hour: 10,
			minute: 30,
			dayOfWeek: 1, // Monday
		};
		// 2026-04-10 is Friday — next Monday is 2026-04-13
		const now = new Date("2026-04-10T12:00:00Z");
		const next = computeNextScheduledRun(config, now);
		expect(next).toEqual(new Date("2026-04-13T10:30:00Z"));
	});

	it("returns same day for weekly if before scheduled time on the right day", () => {
		const config: ScheduleConfig = {
			frequency: "weekly",
			hour: 14,
			minute: 0,
			dayOfWeek: 5, // Friday
		};
		// 2026-04-10 is Friday at 10:00 — should be today at 14:00
		const now = new Date("2026-04-10T10:00:00Z");
		const next = computeNextScheduledRun(config, now);
		expect(next).toEqual(new Date("2026-04-10T14:00:00Z"));
	});

	it("rolls to next week if time has passed on the scheduled weekday", () => {
		const config: ScheduleConfig = {
			frequency: "weekly",
			hour: 10,
			minute: 0,
			dayOfWeek: 5, // Friday
		};
		// 2026-04-10 is Friday at 12:00 — should be next Friday
		const now = new Date("2026-04-10T12:00:00Z");
		const next = computeNextScheduledRun(config, now);
		expect(next).toEqual(new Date("2026-04-17T10:00:00Z"));
	});
});

describe("renderSourceToPayload", () => {
	it("renders a waste_collection source into a notification payload", () => {
		const source: SourceData = {
			id: 42,
			name: "Wywóz śmieci — Wiśniowa",
			type: "waste_collection",
			config: {
				cityName: "Kraków",
				streetName: "ul. Wiśniowa",
				wasteTypes: ["Papier", "Plastik"],
			},
		};

		const payload = renderSourceToPayload(source, {
			channelId: 7,
			recipient: "+48123456789",
			scheduledDate: "2026-04-11",
			notificationType: "day_before",
		});

		expect(payload.sourceId).toBe(42);
		expect(payload.channelId).toBe(7);
		expect(payload.recipient).toBe("+48123456789");
		expect(payload.subject).toBe("Wywóz śmieci — Wiśniowa");
		expect(payload.body).toContain("Jutro");
		expect(payload.body).toContain("2026-04-11");
		expect(payload.body).toContain("Papier");
		expect(payload.body).toContain("Plastik");
		expect(payload.body).toContain("Wiśniowa");
	});

	it("renders a same_day notification", () => {
		const source: SourceData = {
			id: 1,
			name: "Wywóz śmieci",
			type: "waste_collection",
			config: {
				cityName: "Warszawa",
				streetName: "ul. Krucza",
				wasteTypes: ["Szkło"],
			},
		};

		const payload = renderSourceToPayload(source, {
			channelId: 2,
			recipient: "chat-123",
			scheduledDate: "2026-04-10",
			notificationType: "same_day",
		});

		expect(payload.body).toContain("Dzisiaj");
		expect(payload.body).toContain("Szkło");
	});

	it("renders a generic source type with minimal payload", () => {
		const source: SourceData = {
			id: 5,
			name: "Custom reminder",
			type: "custom",
			config: { message: "Don't forget!" },
		};

		const payload = renderSourceToPayload(source, {
			channelId: 3,
			recipient: "user@example.com",
			scheduledDate: "2026-04-10",
			notificationType: "same_day",
		});

		expect(payload.sourceId).toBe(5);
		expect(payload.subject).toBe("Custom reminder");
		expect(payload.body).toBe("Don't forget!");
	});
});
