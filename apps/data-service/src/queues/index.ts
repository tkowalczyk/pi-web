import { sendSms, formatWasteNotification, isValidPolishPhone } from "../services/sms";
import { createNotificationLog, updateNotificationStatus, getNotificationLog } from "@repo/data-ops/queries/notifications";

const RATE_LIMIT_DELAY_MS = 200;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function handleQueue(batch: MessageBatch<NotificationMessage>, env: Env) {
  for (const message of batch.messages) {
    try {
      const {
        userId,
        phone,
        addressId,
        cityId,
        cityName,
        streetName,
        notificationPreferenceId,
        notificationType,
        wasteTypes,
        scheduledDate
      } = message.body;

      if (!isValidPolishPhone(phone)) {
        console.error(`Invalid phone format for user ${userId}: ${phone}`);
        message.ack();
        continue;
      }

      const existingLog = await getNotificationLog(userId, addressId, scheduledDate, notificationPreferenceId);
      if (existingLog && (existingLog.status === "sent" || existingLog.status === "delivered")) {
        console.log(`Notification already sent for user ${userId}`);
        message.ack();
        continue;
      }

      const wasteTypeNames = wasteTypes.map(w => w.wasteTypeName);
      const smsContent = formatWasteNotification(wasteTypeNames, cityName, streetName, scheduledDate, notificationType);

      const [log] = await createNotificationLog({
        userId,
        addressId,
        notificationPreferenceId,
        wasteTypeIds: wasteTypes.map(w => w.wasteTypeId),
        scheduledDate,
        phoneNumber: phone,
        smsContent,
        status: "pending",
      });

      if (!log) {
        console.error(`Failed to create notification log for user ${userId}`);
        message.retry();
        continue;
      }

      await sleep(RATE_LIMIT_DELAY_MS);

      const result = await sendSms(
        env.SERWERSMS_API_TOKEN,
        phone,
        smsContent,
        env.SERWERSMS_SENDER_NAME
      );

      if ("error" in result) {
        await updateNotificationStatus(log.id, "failed", {
          errorMessage: result.error,
        });
        message.retry();
      } else {
        await updateNotificationStatus(log.id, "sent", {
          serwerSmsStatus: result.status,
          serwerSmsMessageId: result.messageId,
          messageParts: result.parts,
        });

        message.ack();
      }
    } catch (error) {
      console.error("Queue processing error:", error);
      message.retry();
    }
  }
}
