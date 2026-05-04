import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { leadsApp } from "./leads";
import { NoopChannel } from "@repo/test-harness/noop-channel";

const noop = new NoopChannel();

vi.mock("@/channels/telegram", () => ({
	TelegramChannel: class {
		send(p: Parameters<typeof noop.send>[0]) {
			return noop.send(p);
		}
		createForumTopic() {
			return Promise.resolve(999);
		}
	},
}));

describe("leads handler", () => {
	let app: Hono;

	beforeEach(() => {
		noop.reset();
		app = new Hono();
		app.route("/leads", leadsApp);
	});

	it("POST /leads/notify sends payload via channel and returns 200", async () => {
		const env = {
			TELEGRAM_BOT_TOKEN: "tok",
			TELEGRAM_GROUP_CHAT_ID: "chat-1",
			CACHE: {
				get: vi.fn().mockResolvedValue("321"),
				put: vi.fn().mockResolvedValue(undefined),
			},
		};

		const res = await app.request(
			"/leads/notify",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "lead@example.com",
					createdAt: "2026-05-04T10:30:00.000Z",
				}),
			},
			env,
		);

		expect(res.status).toBe(200);
		expect(noop.invocations).toHaveLength(1);
		const sent = noop.invocations[0]!.payload;
		expect(sent.recipient).toBe("chat-1");
		expect(sent.body).toContain("<code>lead@example.com</code>");
		expect(sent.metadata).toEqual({ message_thread_id: 321 });
	});

	it("POST /leads/notify returns 503 when Telegram is not configured", async () => {
		const env = {
			CACHE: { get: vi.fn(), put: vi.fn() },
		};

		const res = await app.request(
			"/leads/notify",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "lead@example.com", createdAt: "2026-05-04T10:30:00.000Z" }),
			},
			env,
		);

		expect(res.status).toBe(503);
		expect(noop.invocations).toHaveLength(0);
	});

	it("POST /leads/notify returns 400 on invalid input", async () => {
		const env = {
			TELEGRAM_BOT_TOKEN: "tok",
			TELEGRAM_GROUP_CHAT_ID: "chat-1",
			CACHE: { get: vi.fn(), put: vi.fn() },
		};

		const res = await app.request(
			"/leads/notify",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "not-an-email" }),
			},
			env,
		);

		expect(res.status).toBe(400);
	});
});
