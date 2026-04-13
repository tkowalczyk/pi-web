import { describe, it, expect } from "vitest";
import { BirthdayConfig } from "./birthday-config";

describe("BirthdayConfig zod schema", () => {
	it("accepts a valid birthday config", () => {
		const input = {
			birthdays: [
				{ name: "Mama", date: "03-15" },
				{ name: "Tata", date: "11-02" },
			],
		};

		const result = BirthdayConfig.safeParse(input);
		expect(result.success).toBe(true);
		expect(result.data).toEqual(input);
	});

	it("rejects config without birthdays array", () => {
		const result = BirthdayConfig.safeParse({});
		expect(result.success).toBe(false);
	});

	it("rejects config with empty birthdays array", () => {
		const result = BirthdayConfig.safeParse({ birthdays: [] });
		expect(result.success).toBe(false);
	});

	it("rejects birthday entry with empty name", () => {
		const result = BirthdayConfig.safeParse({
			birthdays: [{ name: "", date: "03-15" }],
		});
		expect(result.success).toBe(false);
	});

	it("rejects birthday entry with invalid date format", () => {
		const result = BirthdayConfig.safeParse({
			birthdays: [{ name: "Mama", date: "2026-03-15" }],
		});
		expect(result.success).toBe(false);
	});

	it("rejects birthday entry with impossible date", () => {
		const result = BirthdayConfig.safeParse({
			birthdays: [{ name: "Mama", date: "13-01" }],
		});
		expect(result.success).toBe(false);
	});

	it("accepts February 29 (leap day birthday)", () => {
		const result = BirthdayConfig.safeParse({
			birthdays: [{ name: "Leap baby", date: "02-29" }],
		});
		expect(result.success).toBe(true);
	});
});
