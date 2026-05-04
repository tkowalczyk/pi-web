import { describe, expect, it } from "vitest";
import { parseAcceptLanguage } from "./parse-accept-language";

describe("parseAcceptLanguage", () => {
	it("returns 'pl' default when header is undefined", () => {
		expect(parseAcceptLanguage(undefined)).toBe("pl");
	});

	it("returns 'pl' when header is exactly 'pl'", () => {
		expect(parseAcceptLanguage("pl")).toBe("pl");
	});

	it("returns 'en' when header is exactly 'en'", () => {
		expect(parseAcceptLanguage("en")).toBe("en");
	});

	it("strips region: 'pl-PL' → 'pl', 'en-US' → 'en'", () => {
		expect(parseAcceptLanguage("pl-PL")).toBe("pl");
		expect(parseAcceptLanguage("en-US")).toBe("en");
	});

	it("respects q-values: 'en-US,en;q=0.9,pl;q=0.5' → 'en'", () => {
		expect(parseAcceptLanguage("en-US,en;q=0.9,pl;q=0.5")).toBe("en");
	});

	it("falls back to 'pl' when no supported language matches: 'de,fr;q=0.9'", () => {
		expect(parseAcceptLanguage("de,fr;q=0.9")).toBe("pl");
	});

	it("picks highest-q supported language regardless of order: 'de,en;q=0.5,pl;q=0.9' → 'pl'", () => {
		expect(parseAcceptLanguage("de,en;q=0.5,pl;q=0.9")).toBe("pl");
	});

	it("prefers higher q-value when first listed lang is supported but lower-ranked: 'en;q=0.5,pl;q=0.9' → 'pl'", () => {
		expect(parseAcceptLanguage("en;q=0.5,pl;q=0.9")).toBe("pl");
	});

	it("treats missing q as 1.0: 'pl;q=0.9,en' → 'en'", () => {
		expect(parseAcceptLanguage("pl;q=0.9,en")).toBe("en");
	});

	it("returns 'pl' for empty string", () => {
		expect(parseAcceptLanguage("")).toBe("pl");
	});

	it("returns 'pl' for null", () => {
		expect(parseAcceptLanguage(null)).toBe("pl");
	});
});
