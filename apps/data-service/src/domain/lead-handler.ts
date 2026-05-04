/**
 * Pure function — renders HTML notification for a new lead.
 * Timestamp is formatted in Europe/Warsaw local time as YYYY-MM-DD HH:mm.
 */
export function renderMessage(email: string, timestamp: Date): string {
	const local = formatWarsawLocal(timestamp);
	return `📩 <b>Nowy lead</b>\n<code>${email}</code>\n📅 ${local}`;
}

function formatWarsawLocal(date: Date): string {
	const fmt = new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Europe/Warsaw",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	// "sv-SE" produces "YYYY-MM-DD HH:mm"
	return fmt.format(date);
}
