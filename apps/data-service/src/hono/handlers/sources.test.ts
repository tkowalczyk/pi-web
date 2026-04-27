import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { sourcesApp } from "./sources";

// Mock data-ops queries
vi.mock("@repo/data-ops/queries/notification-sources", () => ({
	createNotificationSource: vi.fn().mockResolvedValue({
		id: 1,
		householdId: 10,
		name: "Wywóz — Kwiatowa",
		type: "waste_collection",
		config: { address: "ul. Kwiatowa 5", schedule: [{ type: "szkło", dates: ["2026-04-15"] }] },
		alertBeforeHours: 18,
		topicId: null,
		enabled: true,
		createdAt: new Date(),
		updatedAt: new Date(),
	}),
	getNotificationSourceById: vi.fn().mockResolvedValue({
		id: 1,
		householdId: 10,
		name: "Wywóz — Kwiatowa",
		type: "waste_collection",
		config: { address: "ul. Kwiatowa 5", schedule: [{ type: "szkło", dates: ["2026-04-15"] }] },
		alertBeforeHours: 18,
		topicId: null,
		enabled: true,
		createdAt: new Date(),
		updatedAt: new Date(),
	}),
	updateNotificationSource: vi.fn().mockResolvedValue({
		id: 1,
		name: "Updated",
		type: "waste_collection",
		config: {},
		alertBeforeHours: 12,
		topicId: 777,
		enabled: true,
	}),
	deleteNotificationSource: vi.fn().mockResolvedValue(undefined),
}));

// Mock source lifecycle
vi.mock("@/domain/source-lifecycle", () => ({
	createSourceWithTopic: vi.fn().mockResolvedValue({
		id: 1,
		name: "Wywóz — Kwiatowa",
		type: "waste_collection",
		topicId: 777,
	}),
}));

vi.mock("@repo/data-ops/queries/household", () => ({
	getHousehold: vi.fn().mockResolvedValue({
		id: 10,
		name: "Dom",
		timezone: "Europe/Warsaw",
	}),
}));

import { createNotificationSource } from "@repo/data-ops/queries/notification-sources";

describe("sources handler", () => {
	let app: Hono;

	beforeEach(() => {
		vi.clearAllMocks();
		app = new Hono();
		app.route("/sources", sourcesApp);
	});

	it("POST /sources creates source without Telegram and returns 201", async () => {
		const res = await app.request("/sources", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				householdId: 10,
				name: "Wywóz — Kwiatowa",
				type: "waste_collection",
				config: { address: "ul. Kwiatowa 5", schedule: [{ type: "szkło", dates: ["2026-04-15"] }] },
				alertBeforeHours: 18,
			}),
		});

		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.id).toBe(1);
		expect(createNotificationSource).toHaveBeenCalledOnce();
	});

	it("POST /sources rejects invalid config shape", async () => {
		const res = await app.request("/sources", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				householdId: 10,
				name: "Test",
				type: "waste_collection",
				config: { birthdays: [{ name: "X", date: "03-15" }] },
			}),
		});

		expect(res.status).toBe(400);
	});

	it("PUT /sources/:id updates source", async () => {
		const res = await app.request("/sources/1", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Updated",
				alertBeforeHours: 12,
			}),
		});

		expect(res.status).toBe(200);
	});

	it("POST /sources/:id/reschedule calls SchedulerDO.scheduleFromSource", async () => {
		const scheduleFromSource = vi.fn().mockResolvedValue({
			sourceId: 1,
			nextAlarmAt: new Date("2030-04-29T04:00:00Z"),
			lastRunAt: null,
			lastRunSuccess: null,
			status: "scheduled",
		});

		const stub = { scheduleFromSource };
		const env = {
			TELEGRAM_GROUP_CHAT_ID: "-100123",
			SCHEDULER: {
				idFromName: vi.fn().mockReturnValue("doid"),
				get: vi.fn().mockReturnValue(stub),
			},
		};

		const res = await app.request("/sources/1/reschedule", { method: "POST" }, env);

		expect(res.status).toBe(200);
		expect(scheduleFromSource).toHaveBeenCalledWith(
			expect.objectContaining({ id: 1, type: "waste_collection" }),
			18,
			"Europe/Warsaw",
			expect.objectContaining({ recipient: "-100123" }),
		);
		expect(env.SCHEDULER.idFromName).toHaveBeenCalledWith("source-1");
	});

	it("POST /sources/:id/reschedule returns 404 when source missing", async () => {
		const { getNotificationSourceById } = await import(
			"@repo/data-ops/queries/notification-sources"
		);
		vi.mocked(getNotificationSourceById).mockResolvedValueOnce(undefined as never);

		const env = {
			TELEGRAM_GROUP_CHAT_ID: "-100123",
			SCHEDULER: { idFromName: vi.fn(), get: vi.fn() },
		};

		const res = await app.request("/sources/9999/reschedule", { method: "POST" }, env);
		expect(res.status).toBe(404);
	});

	it("GET /sources/:id/state returns SchedulerDO state", async () => {
		const stubState = {
			sourceId: 1,
			nextAlarmAt: new Date("2026-04-29T04:00:00Z"),
			lastRunAt: null,
			lastRunSuccess: null,
			status: "scheduled",
		};
		const stub = { getState: vi.fn().mockResolvedValue(stubState) };
		const env = {
			SCHEDULER: {
				idFromName: vi.fn().mockReturnValue("doid"),
				get: vi.fn().mockReturnValue(stub),
			},
		};

		const res = await app.request("/sources/1/state", { method: "GET" }, env);

		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.sourceId).toBe(1);
		expect(body.nextAlarmAt).toBe("2026-04-29T04:00:00.000Z");
		expect(body.status).toBe("scheduled");
		expect(env.SCHEDULER.idFromName).toHaveBeenCalledWith("source-1");
	});

	it("DELETE /sources/:id deletes source", async () => {
		const res = await app.request("/sources/1", {
			method: "DELETE",
		});

		expect(res.status).toBe(204);
	});
});
