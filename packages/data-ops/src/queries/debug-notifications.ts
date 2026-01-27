import { getDb } from "@/database/setup";
import { auth_user } from "@/drizzle/auth-schema";
import {
  addresses,
  cities,
  streets,
  waste_schedules,
  waste_types,
  notification_preferences,
  subscriptions,
} from "@/drizzle/schema";
import { eq, and, gte } from "drizzle-orm";

export async function debugUserNotifications(userIdOrEmail: string) {
  const db = getDb();
  const now = new Date();

  const [user] = await db
    .select()
    .from(auth_user)
    .where(
      userIdOrEmail.includes("@")
        ? eq(auth_user.email, userIdOrEmail)
        : eq(auth_user.id, userIdOrEmail)
    );

  if (!user) {
    return { error: "User not found", userId: userIdOrEmail };
  }

  const userId = user.id;

  const userAddresses = await db
    .select({
      addressId: addresses.id,
      cityId: addresses.cityId,
      streetId: addresses.streetId,
      cityName: cities.name,
      streetName: streets.name,
    })
    .from(addresses)
    .leftJoin(cities, eq(addresses.cityId, cities.id))
    .leftJoin(streets, eq(addresses.streetId, streets.id))
    .where(eq(addresses.userId, userId));

  const notifPrefs = await db
    .select()
    .from(notification_preferences)
    .where(eq(notification_preferences.userId, userId));

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));

  const activeSubscription = subscription
    ? subscription.status === "active" && subscription.currentPeriodEnd >= now
    : false;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0]!;
  const todayStr = now.toISOString().split("T")[0]!;

  const targetDay = tomorrow.getDate();
  const targetMonth = String(tomorrow.getMonth() + 1);
  const todayDay = now.getDate();
  const todayMonth = String(now.getMonth() + 1);

  const cityStreetPairs = userAddresses
    .filter((a) => a.cityId && a.streetId)
    .map((a) => ({ cityId: a.cityId!, streetId: a.streetId! }));

  const scheduleResults: Record<
    string,
    { tomorrow: string[]; today: string[] }
  > = {};

  for (const pair of cityStreetPairs) {
    const schedules = await db
      .select({
        month: waste_schedules.month,
        days: waste_schedules.days,
        wasteTypeName: waste_types.name,
      })
      .from(waste_schedules)
      .leftJoin(waste_types, eq(waste_schedules.wasteTypeId, waste_types.id))
      .where(
        and(
          eq(waste_schedules.cityId, pair.cityId),
          eq(waste_schedules.streetId, pair.streetId)
        )
      );

    const key = `${pair.cityId}-${pair.streetId}`;
    scheduleResults[key] = { tomorrow: [], today: [] };

    for (const s of schedules) {
      if (!s.days) continue;
      const days = JSON.parse(s.days) as number[];

      if (s.month === targetMonth && days.includes(targetDay)) {
        scheduleResults[key]!.tomorrow.push(s.wasteTypeName || "unknown");
      }
      if (s.month === todayMonth && days.includes(todayDay)) {
        scheduleResults[key]!.today.push(s.wasteTypeName || "unknown");
      }
    }
  }

  const phoneValid = user.phone
    ? /^\+48\d{9}$/.test(user.phone.replace(/\s/g, ""))
    : false;

  const month = now.getUTCMonth();
  const isSummerTime = month >= 3 && month <= 9;
  const cetOffset = isSummerTime ? 2 : 1;
  const currentCetHour = (now.getUTCHours() + cetOffset) % 24;

  const issues: string[] = [];

  if (!user.phone) issues.push("NO_PHONE");
  else if (!phoneValid) issues.push(`INVALID_PHONE_FORMAT: "${user.phone}"`);

  if (!subscription) issues.push("NO_SUBSCRIPTION");
  else if (subscription.status !== "active")
    issues.push(`SUBSCRIPTION_STATUS: ${subscription.status}`);
  else if (subscription.currentPeriodEnd < now)
    issues.push(
      `SUBSCRIPTION_EXPIRED: ${subscription.currentPeriodEnd.toISOString()}`
    );

  if (userAddresses.length === 0) issues.push("NO_ADDRESSES");
  else {
    const missingCity = userAddresses.filter((a) => !a.cityId);
    const missingStreet = userAddresses.filter((a) => !a.streetId);
    if (missingCity.length > 0)
      issues.push(`MISSING_CITY: ${missingCity.map((a) => a.addressId).join(",")}`);
    if (missingStreet.length > 0)
      issues.push(`MISSING_STREET: ${missingStreet.map((a) => a.addressId).join(",")}`);
  }

  if (notifPrefs.length === 0) issues.push("NO_NOTIFICATION_PREFS");
  else {
    const disabled = notifPrefs.filter((p) => !p.enabled);
    if (disabled.length === notifPrefs.length) issues.push("ALL_NOTIFICATIONS_DISABLED");

    const hourMismatch = notifPrefs.filter((p) => p.enabled && p.hour !== currentCetHour);
    if (hourMismatch.length > 0) {
      issues.push(
        `HOUR_MISMATCH: prefs=${hourMismatch.map((p) => p.hour).join(",")} current_cet=${currentCetHour}`
      );
    }
  }

  const noSchedules = Object.entries(scheduleResults).filter(
    ([, v]) => v.tomorrow.length === 0 && v.today.length === 0
  );
  if (noSchedules.length === cityStreetPairs.length && cityStreetPairs.length > 0) {
    issues.push(`NO_WASTE_SCHEDULES_FOR_DATES: tomorrow=${tomorrowStr} today=${todayStr}`);
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      phoneValid,
    },
    subscription: subscription
      ? {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          isActive: activeSubscription,
        }
      : null,
    addresses: userAddresses,
    notificationPreferences: notifPrefs.map((p) => ({
      id: p.id,
      addressId: p.addressId,
      enabled: p.enabled,
      hour: p.hour,
      notificationType: p.notificationType,
    })),
    timing: {
      now: now.toISOString(),
      currentCetHour,
      isSummerTime,
      todayStr,
      tomorrowStr,
      todayMonth,
      targetMonth,
      todayDay,
      targetDay,
    },
    wasteSchedules: scheduleResults,
    issues,
    wouldReceiveNotification: issues.length === 0,
  };
}
