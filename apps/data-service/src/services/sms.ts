import { z } from "zod";

const SerwerSmsResponseSchema = z.object({
  success: z.boolean().optional(),
  queued: z.number().optional(),
  unsent: z.number().optional(),
  items: z.array(
    z.object({
      id: z.string(),
      phone: z.string(),
      status: z.string(),
      queued: z.string().optional(),
      parts: z.number(),
      text: z.string(),
      error_code: z.number().optional(),
    })
  ).optional(),
  error: z.object({
    code: z.number(),
    type: z.string(),
    message: z.string(),
  }).optional(),
});

export function isValidPolishPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, "");
  return /^\+48\d{9}$/.test(cleaned);
}

export async function sendSms(
  apiToken: string,
  phoneNumber: string,
  message: string,
  senderName: string = "2waySMS"
): Promise<{ messageId: string; parts: number; status: string } | { error: string }> {
  try {
    const body: Record<string, string> = {
      phone: phoneNumber,
      text: message,
      sender: senderName,
    };

    const response = await fetch("https://api2.serwersms.pl/messages/send_sms.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const rawData = await response.json();
    const data = SerwerSmsResponseSchema.parse(rawData);

    if (data.error) {
      return { error: `SerwerSMS error ${data.error.code}: ${data.error.message}` };
    }

    // Handle queued response (no items array when message is queued)
    if (data.success && data.queued && data.queued > 0) {
      return {
        messageId: "queued",
        parts: 1,
        status: "queued",
      };
    }

    // Handle immediate send response (with items array)
    if (data.items && data.items.length > 0) {
      const sms = data.items[0];

      if (!sms) {
        return { error: "Empty SMS item in response" };
      }

      if (sms.error_code) {
        return { error: `SerwerSMS error code: ${sms.error_code}` };
      }

      return {
        messageId: sms.id,
        parts: sms.parts,
        status: sms.status,
      };
    }

    return { error: "Unexpected response format" };
  } catch (error) {
    return { error: String(error) };
  }
}

export function formatWasteNotification(
  wasteTypes: string[],
  cityName: string,
  streetName: string,
  date: string,
  notificationType: "day_before" | "same_day"
): string {
  const typesList = wasteTypes.join(", ");
  const location = `${streetName}, ${cityName}`;

  if (notificationType === "day_before") {
    return `Przypomnienie: Jutro (${date}) wywóz śmieci na ${location}: ${typesList}.`;
  } else {
    return `Dzisiaj (${date}) wywóz śmieci na ${location}: ${typesList}.`;
  }
}
