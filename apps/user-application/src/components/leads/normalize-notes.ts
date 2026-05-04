export function normalizeNotes(input: string): string | null {
	const trimmed = input.trim();
	return trimmed.length === 0 ? null : trimmed;
}
