import { getDb } from "@/database/setup";
import { waste_schedules, waste_types, addresses, notification_preferences } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getWasteScheduleByUserId(userId: string) {
  const db = getDb();

  // Get notification address
  const notifPref = await db
    .select({ addressId: notification_preferences.addressId })
    .from(notification_preferences)
    .where(eq(notification_preferences.userId, userId))
    .limit(1)
    .then(rows => rows[0]);

  if (!notifPref) return [];

  // Get cityId from address
  const address = await db
    .select({ cityId: addresses.cityId })
    .from(addresses)
    .where(eq(addresses.id, notifPref.addressId))
    .limit(1)
    .then(rows => rows[0]);

  if (!address) return [];

  // Get waste schedules for city
  return await db
    .select({
      id: waste_schedules.id,
      wasteTypeName: waste_types.name,
      wasteTypeId: waste_schedules.wasteTypeId,
      year: waste_schedules.year,
      month: waste_schedules.month,
      days: waste_schedules.days,
    })
    .from(waste_schedules)
    .leftJoin(waste_types, eq(waste_schedules.wasteTypeId, waste_types.id))
    .where(eq(waste_schedules.cityId, address.cityId));
}
