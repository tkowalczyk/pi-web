import { describe, it, expect } from "vitest";
import { parseImportArgs } from "./parse-args";

describe("parseImportArgs", () => {
	it("parses --file flag", () => {
		const opts = parseImportArgs(["--file", "data/2026_4.json"]);
		expect(opts.file).toBe("data/2026_4.json");
	});

	it("parses --dry-run as boolean", () => {
		const opts = parseImportArgs(["--file", "x.json", "--dry-run"]);
		expect(opts.dryRun).toBe(true);
	});

	it("dryRun defaults to false", () => {
		const opts = parseImportArgs(["--file", "x.json"]);
		expect(opts.dryRun).toBe(false);
	});

	it("parses --household-id as integer", () => {
		const opts = parseImportArgs(["--file", "x.json", "--household-id", "5"]);
		expect(opts.householdId).toBe(5);
	});

	it("parses --address with quoted spaces", () => {
		const opts = parseImportArgs(["--file", "x.json", "--address", "Nieporęt, ul. Agawy"]);
		expect(opts.address).toBe("Nieporęt, ul. Agawy");
	});

	it("parses --year as integer", () => {
		const opts = parseImportArgs(["--file", "x.json", "--year", "2027"]);
		expect(opts.year).toBe(2027);
	});

	it("parses --scheduler-url", () => {
		const opts = parseImportArgs(["--file", "x.json", "--scheduler-url", "https://api.example"]);
		expect(opts.schedulerUrl).toBe("https://api.example");
	});

	it("throws when --file is missing", () => {
		expect(() => parseImportArgs([])).toThrow(/--file/);
	});

	it("throws when --household-id is not a positive integer", () => {
		expect(() => parseImportArgs(["--file", "x.json", "--household-id", "abc"])).toThrow(
			/household-id/,
		);
	});

	it("throws when --year is not a 4-digit number", () => {
		expect(() => parseImportArgs(["--file", "x.json", "--year", "abc"])).toThrow(/year/);
	});
});
