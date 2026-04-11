import { describe, it, expect } from "vitest";
import { renderMessage } from "./waste-collection-handler";

describe("WasteCollectionHandler.renderMessage", () => {
	it("renders HTML with emoji for a single waste type", () => {
		const config = {
			address: "ul. Kwiatowa 5",
			schedule: [{ type: "szkło", dates: ["2026-04-15"] }],
		};

		const html = renderMessage(config, "2026-04-15");

		expect(html).toContain("🗑");
		expect(html).toContain("<b>");
		expect(html).toContain("szkło");
		expect(html).toContain("ul. Kwiatowa 5");
		expect(html).toContain("15 kwietnia 2026");
	});

	it("renders HTML with multiple waste types", () => {
		const config = {
			address: "ul. Wiśniowa 12",
			schedule: [
				{ type: "papier", dates: ["2026-04-20"] },
				{ type: "plastik", dates: ["2026-04-20"] },
				{ type: "szkło", dates: ["2026-04-20", "2026-05-04"] },
			],
		};

		const html = renderMessage(config, "2026-04-20");

		expect(html).toContain("🗑");
		expect(html).toContain("papier");
		expect(html).toContain("plastik");
		expect(html).toContain("szkło");
		expect(html).toContain("ul. Wiśniowa 12");
		expect(html).toContain("20 kwietnia 2026");
	});

	it("only includes waste types that have the given collection date", () => {
		const config = {
			address: "ul. Długa 1",
			schedule: [
				{ type: "papier", dates: ["2026-04-20"] },
				{ type: "szkło", dates: ["2026-04-25"] },
			],
		};

		const html = renderMessage(config, "2026-04-20");

		expect(html).toContain("papier");
		expect(html).not.toContain("szkło");
	});
});
