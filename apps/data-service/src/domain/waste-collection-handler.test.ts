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

	it("translates importer's English camelCase types to Polish labels", () => {
		const config = {
			address: "Stanisławów Pierwszy, ul. Jana Kazimierza",
			schedule: [
				{ type: "metalsAndPlastics", dates: ["2026-04-30"] },
				{ type: "bioWaste", dates: ["2026-05-06"] },
				{ type: "christmasTrees", dates: ["2026-02-25"] },
				{ type: "bulkyWaste", dates: ["2026-03-12"] },
				{ type: "mixed", dates: ["2026-04-30"] },
				{ type: "paper", dates: ["2026-04-30"] },
				{ type: "glass", dates: ["2026-04-30"] },
			],
		};

		const html = renderMessage(config, "2026-04-30");

		expect(html).toContain("metale i tworzywa");
		expect(html).toContain("zmieszane");
		expect(html).toContain("papier");
		expect(html).toContain("szkło");
		expect(html).not.toContain("metalsAndPlastics");
		expect(html).not.toContain("mixed");
	});

	it("falls back to the raw type when no Polish label is mapped", () => {
		const config = {
			address: "ul. Testowa",
			schedule: [{ type: "newCustomType", dates: ["2026-04-30"] }],
		};

		const html = renderMessage(config, "2026-04-30");

		expect(html).toContain("newCustomType");
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
