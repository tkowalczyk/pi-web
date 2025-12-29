import { getDb } from "@/database/setup";
import { auth_user } from "@/drizzle/auth-schema";
import {
  addresses,
  cities,
  streets,
  waste_schedules,
  waste_types,
  notification_preferences,
  notification_logs
} from "@/drizzle/schema";
import { eq, and, isNotNull } from "drizzle-orm";

function isValidPolishPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, "");
  return /^\+48\d{9}$/.test(cleaned);
}

export async function getUsersNeedingNotification(
  currentHour: number,
  currentMinute: number,
  targetDate: string
) {
  const db = getDb();

  const schedules = await db
    .select({
      cityId: waste_schedules.cityId,
      streetId: waste_schedules.streetId,
      wasteTypeId: waste_schedules.wasteTypeId,
      wasteTypeName: waste_types.name,
      month: waste_schedules.month,
      days: waste_schedules.days,
    })
    .from(waste_schedules)
    .leftJoin(waste_types, eq(waste_schedules.wasteTypeId, waste_types.id));

  const targetDay = new Date(targetDate).getDate();
  const targetMonth = new Date(targetDate).toLocaleString("en-US", { month: "long" });

  const relevantSchedules = schedules.filter(s => {
    if (!s.days) return false;
    const days = JSON.parse(s.days) as number[];
    return s.month === targetMonth && days.includes(targetDay);
  });

  const schedulesByCityStreet = relevantSchedules.reduce((acc, s) => {
    const key = `${s.cityId}-${s.streetId}`;
    if (!acc[key]) acc[key] = [];
    const streetSchedules = acc[key];
    if (streetSchedules) {
      streetSchedules.push({ wasteTypeId: s.wasteTypeId, wasteTypeName: s.wasteTypeName || "" });
    }
    return acc;
  }, {} as Record<string, Array<{ wasteTypeId: number; wasteTypeName: string }>>);

  if (Object.keys(schedulesByCityStreet).length === 0) return [];

  const users = await db
    .select({
      userId: auth_user.id,
      phone: auth_user.phone,
      addressId: addresses.id,
      cityId: addresses.cityId,
      streetId: addresses.streetId,
      cityName: cities.name,
      streetName: streets.name,
      notificationPreferenceId: notification_preferences.id,
      notificationType: notification_preferences.notificationType,
    })
    .from(notification_preferences)
    .innerJoin(auth_user, eq(notification_preferences.userId, auth_user.id))
    .innerJoin(addresses, eq(notification_preferences.addressId, addresses.id))
    .leftJoin(cities, eq(addresses.cityId, cities.id))
    .leftJoin(streets, eq(addresses.streetId, streets.id))
    .where(
      and(
        eq(notification_preferences.enabled, true),
        eq(notification_preferences.hour, currentHour),
        isNotNull(auth_user.phone),
        isNotNull(addresses.cityId),
        isNotNull(addresses.streetId)
      )
    );

  const now = new Date();
  const nowDate = new Date(now);
  nowDate.setUTCHours(0, 0, 0, 0);

  const target = new Date(targetDate);
  target.setUTCHours(0, 0, 0, 0);

  return users
    .filter(u => {
      const key = `${u.cityId}-${u.streetId}`;
      return u.cityId && u.streetId && schedulesByCityStreet[key];
    })
    .filter(u => u.phone && isValidPolishPhone(u.phone))
    .map(u => {
      const daysDiff = Math.floor((target.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));
      const isDayBefore = daysDiff === 1 && u.notificationType === "day_before";
      const isSameDay = daysDiff === 0 && u.notificationType === "same_day";

      if (!isDayBefore && !isSameDay) return null;

      const key = `${u.cityId}-${u.streetId}`;
      return {
        userId: u.userId,
        phone: u.phone!.replace(/\s/g, ""),
        addressId: u.addressId,
        cityId: u.cityId!,
        streetId: u.streetId!,
        cityName: u.cityName || "",
        streetName: u.streetName || "",
        notificationPreferenceId: u.notificationPreferenceId,
        notificationType: u.notificationType as "day_before" | "same_day",
        wasteTypes: schedulesByCityStreet[key] || [],
      };
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);
}

export async function createNotificationLog(data: {
  userId: string;
  addressId: number;
  notificationPreferenceId: number;
  wasteTypeIds: number[];
  scheduledDate: string;
  phoneNumber: string;
  smsContent: string;
  status: "pending" | "sent" | "failed" | "delivered";
  serwerSmsMessageId?: string;
  serwerSmsStatus?: string;
  messageParts?: number;
  sentAt?: Date;
  errorMessage?: string;
}) {
  const db = getDb();
  return await db.insert(notification_logs).values({
    ...data,
    wasteTypeIds: JSON.stringify(data.wasteTypeIds),
  }).returning();
}

export async function updateNotificationStatus(
  id: number,
  status: "sent" | "failed" | "delivered",
  updates: {
    serwerSmsStatus?: string;
    deliveredAt?: Date;
    errorMessage?: string;
    serwerSmsMessageId?: string;
    messageParts?: number;
  }
) {
  const db = getDb();
  return await db
    .update(notification_logs)
    .set({ status, ...updates })
    .where(eq(notification_logs.id, id));
}

export async function getNotificationLog(
  userId: string,
  addressId: number,
  scheduledDate: string,
  notificationPreferenceId: number
) {
  const db = getDb();
  const [log] = await db
    .select()
    .from(notification_logs)
    .where(
      and(
        eq(notification_logs.userId, userId),
        eq(notification_logs.addressId, addressId),
        eq(notification_logs.scheduledDate, scheduledDate),
        eq(notification_logs.notificationPreferenceId, notificationPreferenceId)
      )
    );
  return log;
}
