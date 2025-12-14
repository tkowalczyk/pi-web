import { getDb } from "@/database/setup";
import { notification_preferences } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

export async function getUserNotificationPreferences(userId: string, addressId?: number) {
  const db = getDb();

  if (addressId) {
    return await db
      .select()
      .from(notification_preferences)
      .where(
        and(
          eq(notification_preferences.userId, userId),
          eq(notification_preferences.addressId, addressId)
        )
      );
  }

  return await db
    .select()
    .from(notification_preferences)
    .where(eq(notification_preferences.userId, userId));
}

export async function createDefaultNotificationPreferences(userId: string, addressId: number) {
  const db = getDb();

  const defaults = [
    { userId, addressId, notificationType: "day_before", hour: 19, minute: 0, enabled: true },
    { userId, addressId, notificationType: "same_day", hour: 7, minute: 0, enabled: true },
  ];

  return await db
    .insert(notification_preferences)
    .values(defaults)
    .returning();
}

export async function updateNotificationPreference(
  id: number,
  data: { hour?: number; minute?: number; enabled?: boolean }
) {
  const db = getDb();
  await db
    .update(notification_preferences)
    .set(data)
    .where(eq(notification_preferences.id, id));
}
