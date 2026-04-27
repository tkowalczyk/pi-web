import path from "node:path";

export function extractYearFromFilename(input: string): number | null {
	const base = path.basename(input);
	const match = base.match(/^(\d{4})_\d+\.json$/);
	if (!match) return null;
	return Number(match[1]);
}
