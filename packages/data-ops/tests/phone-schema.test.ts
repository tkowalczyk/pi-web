import { describe, it, expect } from "vitest";
import { normalizePolishPhone, phoneSchema, updatePhoneSchema } from "../src/zod-schema/phone";

describe("normalizePolishPhone", () => {
  it("should normalize +48 xxx xxx xxx format", () => {
    expect(normalizePolishPhone("+48 123 456 789")).toBe("+48 123 456 789");
  });

  it("should normalize +48xxxxxxxxx format (no spaces)", () => {
    expect(normalizePolishPhone("+48123456789")).toBe("+48 123 456 789");
  });

  it("should normalize 48xxxxxxxxx format (no + or spaces)", () => {
    expect(normalizePolishPhone("48123456789")).toBe("+48 123 456 789");
  });

  it("should normalize xxxxxxxxx format (9 digits only)", () => {
    expect(normalizePolishPhone("123456789")).toBe("+48 123 456 789");
  });

  it("should normalize with extra whitespace", () => {
    expect(normalizePolishPhone("+48  123  456  789")).toBe("+48 123 456 789");
  });

  it("should throw on invalid length (too short)", () => {
    expect(() => normalizePolishPhone("12345678")).toThrow("Invalid phone number length");
  });

  it("should throw on invalid length (too long)", () => {
    expect(() => normalizePolishPhone("1234567890")).toThrow("Invalid phone number length");
  });

  it("should throw on non-digit characters", () => {
    expect(() => normalizePolishPhone("12345678a")).toThrow("Phone number must contain only digits");
  });

  it("should throw on special characters", () => {
    expect(() => normalizePolishPhone("123-456-789")).toThrow();
  });
});

describe("phoneSchema", () => {
  it("should parse valid +48 xxx xxx xxx format", () => {
    expect(phoneSchema.parse("+48 123 456 789")).toBe("+48 123 456 789");
  });

  it("should parse and normalize various formats", () => {
    expect(phoneSchema.parse("+48123456789")).toBe("+48 123 456 789");
    expect(phoneSchema.parse("48123456789")).toBe("+48 123 456 789");
    expect(phoneSchema.parse("123456789")).toBe("+48 123 456 789");
  });

  it("should throw on invalid phone", () => {
    expect(() => phoneSchema.parse("invalid")).toThrow();
  });

  it("should throw on empty string", () => {
    expect(() => phoneSchema.parse("")).toThrow();
  });
});

describe("updatePhoneSchema", () => {
  it("should parse valid phone in object", () => {
    const result = updatePhoneSchema.parse({ phone: "+48 123 456 789" });
    expect(result.phone).toBe("+48 123 456 789");
  });

  it("should normalize phone in object", () => {
    const result = updatePhoneSchema.parse({ phone: "123456789" });
    expect(result.phone).toBe("+48 123 456 789");
  });

  it("should throw on empty phone string", () => {
    expect(() => updatePhoneSchema.parse({ phone: "" })).toThrow("Phone number is required");
  });

  it("should throw on whitespace-only phone", () => {
    expect(() => updatePhoneSchema.parse({ phone: "   " })).toThrow("Phone number is required");
  });

  it("should throw on invalid phone format", () => {
    expect(() => updatePhoneSchema.parse({ phone: "invalid" })).toThrow();
  });
});
