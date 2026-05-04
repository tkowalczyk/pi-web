import { describe, expect, it } from "vitest";
import { normalizeNotes } from "./normalize-notes";

describe("normalizeNotes", () => {
	it("returns trimmed string when content is present", () => {
		expect(normalizeNotes("  Called 2026-05-01  ")).toBe("Called 2026-05-01");
	});

	it("returns null when input is whitespace-only", () => {
		expect(normalizeNotes("   \n\t  ")).toBeNull();
	});

	it("returns null when input is empty string", () => {
		expect(normalizeNotes("")).toBeNull();
	});

	it("preserves internal whitespace and newlines", () => {
		expect(normalizeNotes("line one\nline two")).toBe("line one\nline two");
	});
});
