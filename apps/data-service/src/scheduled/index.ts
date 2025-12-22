import { getUsersNeedingNotification } from "@repo/data-ops/queries/notifications";

export async function handleScheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();

  const month = now.getUTCMonth();
  const isSummerTime = month >= 3 && month <= 9;
  const cetOffset = isSummerTime ? 2 : 1;
  const cetHour = (currentHour + cetOffset) % 24;

  console.log(`Cron triggered at UTC ${currentHour}:${currentMinute} = CET/CEST ${cetHour}:${currentMinute}`);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0]!;

  const tomorrowUsers = await getUsersNeedingNotification(cetHour, currentMinute, tomorrowStr);

  const todayStr = now.toISOString().split("T")[0]!;
  const todayUsers = await getUsersNeedingNotification(cetHour, currentMinute, todayStr);

  const allUsers = [...tomorrowUsers, ...todayUsers];

  console.log(`Found ${allUsers.length} users to notify`);

  const batch: MessageSendRequest<NotificationMessage>[] = allUsers.map(user => ({
    body: {
      userId: user.userId,
      phone: user.phone,
      addressId: user.addressId,
      cityId: user.cityId,
      streetId: user.streetId,
      cityName: user.cityName,
      streetName: user.streetName,
      notificationPreferenceId: user.notificationPreferenceId,
      notificationType: user.notificationType,
      wasteTypes: user.wasteTypes,
      scheduledDate: user.notificationType === "day_before" ? tomorrowStr : todayStr,
    },
  }));

  if (batch.length > 0) {
    await env.NOTIFICATION_QUEUE.sendBatch(batch);
    console.log(`Queued ${batch.length} notifications`);
  }
}
