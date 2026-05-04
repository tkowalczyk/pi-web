import { describe, it, expect } from "vitest";
import { renderMessage } from "./lead-handler";

describe("LeadNotificationHandler.renderMessage", () => {
	it("renders HTML containing emoji, bold heading, email in <code>, and timestamp marker", () => {
		const html = renderMessage("user@example.com", new Date("2026-05-04T10:30:00Z"));

		expect(html).toContain("📩");
		expect(html).toContain("<b>Nowy lead</b>");
		expect(html).toContain("<code>user@example.com</code>");
		expect(html).toContain("📅");
	});

	it("formats timestamp in Europe/Warsaw local time (CEST: UTC+2)", () => {
		// 2026-05-04 10:30 UTC → 12:30 CEST
		const html = renderMessage("a@b.c", new Date("2026-05-04T10:30:00Z"));

		expect(html).toBe("📩 <b>Nowy lead</b>\n<code>a@b.c</code>\n📅 2026-05-04 12:30");
	});

	it("formats timestamp in Europe/Warsaw local time (CET: UTC+1, winter)", () => {
		// 2026-01-15 10:30 UTC → 11:30 CET
		const html = renderMessage("winter@example.com", new Date("2026-01-15T10:30:00Z"));

		expect(html).toBe("📩 <b>Nowy lead</b>\n<code>winter@example.com</code>\n📅 2026-01-15 11:30");
	});
});
