import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelegramChannel } from "./telegram";
import type { NotificationPayload } from "@repo/data-ops/channels/port";

const payload: NotificationPayload = {
	recipient: "-1001234567890",
	subject: "Test",
	body: "<b>Hello</b>",
	sourceId: 1,
	channelId: 1,
	metadata: { message_thread_id: 42 },
};

function mockFetch(response: object, status = 200): typeof fetch {
	return vi.fn().mockResolvedValue(
		new Response(JSON.stringify(response), {
			status,
			headers: { "Content-Type": "application/json" },
		}),
	);
}

function noopLogger() {
	return {
		logDelivery: vi.fn(),
		logFailure: vi.fn(),
	};
}

function createChannel(overrides: { fetchFn?: typeof fetch; logger?: ReturnType<typeof noopLogger> } = {}) {
	return new TelegramChannel({
		botToken: "fake-bot-token",
		fetchFn: overrides.fetchFn ?? mockFetch({ ok: true, result: { message_id: 999 } }),
		logger: overrides.logger ?? noopLogger(),
	});
}

describe("TelegramChannel", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it("implements NotificationChannel with name 'telegram'", () => {
		const channel = createChannel();
		expect(channel.name).toBe("telegram");
	});

	it("sends message via Telegram Bot API and returns success", async () => {
		const fetchFn = mockFetch({ ok: true, result: { message_id: 999 } });
		const channel = createChannel({ fetchFn });

		const result = await channel.send(payload);

		expect(result.success).toBe(true);
		expect(result.messageId).toBe("999");
		expect(result.timestamp).toBeInstanceOf(Date);

		expect(fetchFn).toHaveBeenCalledOnce();
		const [url, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(url).toBe("https://api.telegram.org/botfake-bot-token/sendMessage");
		const body = JSON.parse(options.body);
		expect(body.chat_id).toBe("-1001234567890");
		expect(body.text).toBe("<b>Hello</b>");
		expect(body.parse_mode).toBe("HTML");
		expect(body.message_thread_id).toBe(42);
	});

	it("retries on HTTP 429 and succeeds on next attempt", async () => {
		const fetchFn = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ok: false }), { status: 429 }),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ok: true, result: { message_id: 123 } }), { status: 200 }),
			);
		const logger = noopLogger();
		const channel = createChannel({ fetchFn, logger });

		const promise = channel.send(payload);
		await vi.advanceTimersByTimeAsync(1000);
		const result = await promise;

		expect(result.success).toBe(true);
		expect(result.messageId).toBe("123");
		expect(fetchFn).toHaveBeenCalledTimes(2);
		expect(logger.logDelivery).toHaveBeenCalledWith(
			expect.objectContaining({ status: "success", retryCount: 1 }),
		);
	});

	it("retries on HTTP 5xx and succeeds on next attempt", async () => {
		const fetchFn = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response("Server Error", { status: 500 }),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ok: true, result: { message_id: 456 } }), { status: 200 }),
			);
		const channel = createChannel({ fetchFn });

		const promise = channel.send(payload);
		await vi.advanceTimersByTimeAsync(1000);
		const result = await promise;

		expect(result.success).toBe(true);
		expect(fetchFn).toHaveBeenCalledTimes(2);
	});

	it("returns failure and logs dead letter after 3 retries exhausted", async () => {
		const fetchFn = vi
			.fn<typeof fetch>()
			.mockResolvedValue(
				new Response(JSON.stringify({ ok: false }), { status: 429 }),
			);
		const logger = noopLogger();
		const channel = createChannel({ fetchFn, logger });

		const promise = channel.send(payload);
		await vi.advanceTimersByTimeAsync(1000);  // retry 1
		await vi.advanceTimersByTimeAsync(4000);  // retry 2
		await vi.advanceTimersByTimeAsync(16000); // retry 3
		const result = await promise;

		expect(result.success).toBe(false);
		expect(result.error).toContain("429");
		expect(fetchFn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
		expect(logger.logDelivery).toHaveBeenCalledWith(
			expect.objectContaining({ status: "failure", retryCount: 3 }),
		);
		expect(logger.logFailure).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceId: 1,
				channel: "telegram",
				retryCount: 3,
				payload,
			}),
		);
	});

	it("logs successful delivery to delivery log", async () => {
		const logger = noopLogger();
		const channel = createChannel({ logger });

		await channel.send(payload);

		expect(logger.logDelivery).toHaveBeenCalledOnce();
		expect(logger.logDelivery).toHaveBeenCalledWith({
			sourceId: 1,
			channel: "telegram",
			status: "success",
			retryCount: 0,
		});
		expect(logger.logFailure).not.toHaveBeenCalled();
	});
});
