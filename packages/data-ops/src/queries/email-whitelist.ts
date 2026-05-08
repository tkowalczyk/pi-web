import { getDb } from "@/database/setup";
import { emailWhitelist } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

function normalize(email: string): string {
	return email.trim().toLowerCase();
}

export async function isEmailWhitelisted(email: string): Promise<boolean> {
	const db = getDb();
	const [row] = await db
		.select({ id: emailWhitelist.id })
		.from(emailWhitelist)
		.where(eq(emailWhitelist.email, normalize(email)))
		.limit(1);
	return Boolean(row);
}

export async function listEmailWhitelist() {
	const db = getDb();
	return await db.select().from(emailWhitelist).orderBy(emailWhitelist.email);
}
