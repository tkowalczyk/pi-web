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

import { createNotificationSource } from "@repo/data-ops/queries/notification-sources";
import { createSourceWithTopic } from "@/domain/source-lifecycle";

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

	it("DELETE /sources/:id deletes source", async () => {
		const res = await app.request("/sources/1", {
			method: "DELETE",
		});

		expect(res.status).toBe(204);
	});
});
