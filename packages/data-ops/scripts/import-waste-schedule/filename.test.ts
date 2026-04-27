import { describe, it, expect } from "vitest";
import { extractYearFromFilename } from "./filename";

describe("extractYearFromFilename", () => {
	it("extracts year from bare YYYY_N.json", () => {
		expect(extractYearFromFilename("2026_4.json")).toBe(2026);
	});

	it("extracts year from full path", () => {
		expect(extractYearFromFilename(".data-to-import/raw/2026_10.json")).toBe(2026);
	});

	it("extracts year from absolute path", () => {
		expect(extractYearFromFilename("/Users/foo/.data-to-import/raw/2025_1.json")).toBe(2025);
	});

	it("returns null when filename has no YYYY_N pattern", () => {
		expect(extractYearFromFilename("schedule.json")).toBeNull();
	});

	it("returns null when filename has bad year shape", () => {
		expect(extractYearFromFilename("123_4.json")).toBeNull();
	});
});
