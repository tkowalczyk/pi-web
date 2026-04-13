import { describe, it, expect } from "vitest";
import { renderMessage } from "./birthday-handler";

describe("BirthdayHandler.renderMessage", () => {
	it("renders HTML with emoji for a single birthday", () => {
		const config = {
			birthdays: [{ name: "Mama", date: "03-15" }],
		};

		const html = renderMessage(config, "Mama");

		expect(html).toContain("🎂");
		expect(html).toContain("<b>");
		expect(html).toContain("Mama");
		expect(html).toContain("Pamiętaj o życzeniach!");
	});

	it("renders the correct birthday person name", () => {
		const config = {
			birthdays: [
				{ name: "Mama", date: "03-15" },
				{ name: "Tata", date: "11-02" },
			],
		};

		const html = renderMessage(config, "Tata");

		expect(html).toContain("Tata");
		expect(html).not.toContain("Mama");
	});

	it("matches the expected HTML format from acceptance criteria", () => {
		const config = {
			birthdays: [{ name: "Mama", date: "03-15" }],
		};

		const html = renderMessage(config, "Mama");

		expect(html).toBe("🎂 <b>Dziś urodziny: Mama</b>\nPamiętaj o życzeniach!");
	});
});
