import { getDb } from "@/database/setup";
import { leads } from "@/drizzle/schema";
import { desc, eq } from "drizzle-orm";
import type { LeadStatus } from "@/zod-schema/lead";

interface InsertLeadInput {
	email: string;
	consentGivenAt: Date;
}

export async function insertLead(input: InsertLeadInput) {
	const db = getDb();
	const rows = await db.insert(leads).values(input).returning();
	return rows[0] as (typeof rows)[number];
}

export async function listLeads() {
	const db = getDb();
	return await db.select().from(leads).orderBy(desc(leads.createdAt));
}

export async function updateLeadStatus(id: number, status: LeadStatus) {
	const db = getDb();
	const [updated] = await db.update(leads).set({ status }).where(eq(leads.id, id)).returning();
	return updated;
}

export async function updateLeadNotes(id: number, notes: string | null) {
	const db = getDb();
	const [updated] = await db.update(leads).set({ notes }).where(eq(leads.id, id)).returning();
	return updated;
}

export async function deleteLead(id: number) {
	const db = getDb();
	await db.delete(leads).where(eq(leads.id, id));
}
