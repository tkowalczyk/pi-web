import { describe, it, expect } from "vitest";
import { verifyTurnstileToken } from "./turnstile";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

describe("verifyTurnstileToken", () => {
	it("POSTs the secret + token to Cloudflare siteverify", async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		const fetcher: typeof fetch = async (input, init) => {
			calls.push({ url: typeof input === "string" ? input : (input as Request).url, init });
			return jsonResponse({ success: true });
		};

		await verifyTurnstileToken("token-abc", "secret-xyz", fetcher);

		expect(calls).toHaveLength(1);
		const call = calls[0]!;
		expect(call.url).toBe(SITEVERIFY_URL);
		expect(call.init?.method).toBe("POST");
		const body = String(call.init?.body ?? "");
		expect(body).toContain("secret=secret-xyz");
		expect(body).toContain("response=token-abc");
	});

	it("returns success=true when CF responds success=true", async () => {
		const fetcher: typeof fetch = async () => jsonResponse({ success: true });
		const result = await verifyTurnstileToken("t", "s", fetcher);
		expect(result.success).toBe(true);
	});

	it("returns success=false when CF responds success=false", async () => {
		const fetcher: typeof fetch = async () =>
			jsonResponse({ success: false, "error-codes": ["invalid-input-response"] });
		const result = await verifyTurnstileToken("t", "s", fetcher);
		expect(result.success).toBe(false);
	});

	it("returns success=false when CF responds non-2xx", async () => {
		const fetcher: typeof fetch = async () => new Response("oops", { status: 500 });
		const result = await verifyTurnstileToken("t", "s", fetcher);
		expect(result.success).toBe(false);
	});

	it("returns success=false on empty/missing token", async () => {
		const fetcher: typeof fetch = async () => jsonResponse({ success: true });
		expect((await verifyTurnstileToken("", "s", fetcher)).success).toBe(false);
	});
});
