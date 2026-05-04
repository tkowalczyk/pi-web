export type SupportedLanguage = "pl" | "en";

const SUPPORTED: ReadonlyArray<SupportedLanguage> = ["pl", "en"];
const DEFAULT_LANG: SupportedLanguage = "pl";

export function parseAcceptLanguage(header: string | null | undefined): SupportedLanguage {
	if (!header) return DEFAULT_LANG;

	const ranked = header
		.split(",")
		.map((entry) => {
			const [tag, ...params] = entry.trim().split(";");
			const base = tag?.trim().toLowerCase().split("-")[0] ?? "";
			const qParam = params.find((p) => p.trim().startsWith("q="));
			const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
			return { lang: base, q: Number.isFinite(q) ? q : 0 };
		})
		.filter((entry): entry is { lang: SupportedLanguage; q: number } =>
			SUPPORTED.includes(entry.lang as SupportedLanguage),
		)
		.sort((a, b) => b.q - a.q);

	return ranked[0]?.lang ?? DEFAULT_LANG;
}
