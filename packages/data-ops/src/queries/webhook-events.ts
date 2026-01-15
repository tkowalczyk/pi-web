import { getDb } from "@/database/setup";
import { webhook_events } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function isEventProcessed(eventId: string): Promise<boolean> {
  const db = getDb();
  const [event] = await db
    .select()
    .from(webhook_events)
    .where(eq(webhook_events.id, eventId))
    .limit(1);

  return event?.processed || false;
}

export async function markEventProcessed(eventId: string, eventType: string): Promise<void> {
  const db = getDb();
  await db.insert(webhook_events).values({
    id: eventId,
    type: eventType,
    processed: true,
  }).onConflictDoNothing();
}
