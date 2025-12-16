# Design Doc: Waste Collection Notification System

## Overview

Daily notification system sending SMS reminders about upcoming waste collection. Uses notification_preferences table for customizable times (default: 19:00 day before, 7:00 same day). Cloudflare Cron (hourly) + Queues for reliable delivery via SMSAPI.pl.

## Architecture Flow

### High-Level Components
```
Scheduled Cron (every hour)
  ↓ (query notification_preferences for current hour)
Database (addresses + notification_preferences + waste_schedules + notification_logs)
  ↓ (batch users into messages)
Cloudflare Queue (notification_queue)
  ↓ (consumer processes batches)
SMSAPI.pl API (send SMS)
  ↓ (log delivery status)
Database (notification_logs table)
```

**Primitives Used:**
- **Cron Triggers** - Hourly execution
- **Queues** - Reliable SMS delivery with retries
- **Worker Bindings** - SMSAPI.pl credentials

### Detailed Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ CRON TRIGGER (every hour at :00)                                │
│ - Fires: 00:00, 01:00, 02:00, ..., 23:00 UTC                   │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ SCHEDULED HANDLER (handleScheduled)                             │
│ 1. Get current UTC time → Convert to CET/CEST                  │
│    - DST offset: Apr-Oct +2h, Nov-Mar +1h                       │
│ 2. Calculate dates:                                             │
│    - today = UTC date (YYYY-MM-DD)                              │
│    - tomorrow = today + 1 day                                   │
│ 3. Query notification_preferences:                              │
│    WHERE hour = cetHour AND enabled = true                      │
│ 4. Query waste_schedules:                                       │
│    - Filter by today/tomorrow dates                             │
│    - Join cities, waste_types                                   │
│ 5. Join users + addresses + phone validation                    │
│    - Filter: cityId IN (cities with waste today/tomorrow)       │
│    - Validate: phone matches +48xxxxxxxxx                       │
│ 6. Build batch: NotificationMessage[]                           │
│    - Include: userId, phone, addressId, wasteTypes,             │
│               scheduledDate, notificationType                   │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ QUEUE PRODUCER (NOTIFICATION_QUEUE.sendBatch)                   │
│ - Push batch to queue                                           │
│ - Async processing decouples from cron timeout                  │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ QUEUE CONSUMER (handleQueue)                                    │
│ - Batch size: 10 messages                                       │
│ - Timeout: 5s per batch                                         │
│ - Max retries: 3 per message                                    │
│                                                                 │
│ FOR EACH MESSAGE:                                               │
│   1. Validate phone format                                      │
│      - If invalid: message.ack() → skip retry                   │
│                                                                 │
│   2. Check idempotency: getNotificationLog()                    │
│      - Query: userId + addressId + scheduledDate + prefId       │
│      - If exists with status "sent"/"delivered":                │
│          message.ack() → skip duplicate                         │
│                                                                 │
│   3. Format SMS content:                                        │
│      - Day before: "Jutro (date) wywóz: types"                  │
│      - Same day: "Dzisiaj (date) wywóz: types"                  │
│                                                                 │
│   4. Create log: createNotificationLog()                        │
│      - Status: "pending"                                        │
│      - Store: smsContent, phone, wasteTypeIds[]                 │
│                                                                 │
│   5. Rate limit: sleep(100ms)                                   │
│      - 10 req/s to stay under SMSAPI 100 req/s limit            │
│                                                                 │
│   6. Send SMS: sendSms(token, phone, content)                   │
│      POST https://api.smsapi.pl/sms.do                          │
│      - Headers: Bearer token, form-urlencoded                   │
│      - Response: {id, points, status, error?}                   │
│                                                                 │
│   7a. SUCCESS PATH:                                             │
│       - Update log: status="sent", smsApiMessageId, cost        │
│       - message.ack() → remove from queue                       │
│                                                                 │
│   7b. FAILURE PATH:                                             │
│       - Update log: status="failed", errorMessage               │
│       - message.retry() → requeue (max 3 retries)               │
│       - After 3 fails → moves to DLQ                            │
│                                                                 │
│   8. EXCEPTION HANDLING:                                        │
│      - Catch errors → message.retry()                           │
│      - Logs written even on crash                               │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE (notification_logs)                                    │
│ - Records all send attempts                                     │
│ - Tracks status: pending → sent/failed → delivered              │
│ - Prevents duplicate sends via idempotency check                │
│ - Indexes: userId, addressId, scheduledDate, status             │
└─────────────────────────────────────────────────────────────────┘

TIMING EXAMPLE (19:00 CET day-before notification):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
18:00 UTC → Cron fires
         → Converts to 19:00 CET (winter) or 20:00 CEST (summer)
         → Queries notification_preferences WHERE hour=19 (CET)
         → Finds users with day_before preference
         → Queries waste_schedules for tomorrow's date
         → Sends batch to queue
         → Queue processes within ~10-20 seconds
         → Users receive SMS at ~19:00 CET

RETRY BEHAVIOR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Attempt 1 → Fail → wait 30s  → Attempt 2
         → Fail → wait 60s  → Attempt 3
         → Fail → wait 120s → Move to DLQ (manual inspection)

IDEMPOTENCY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Queue message retries → Always check notification_logs first
If log exists with status="sent"/"delivered" → Skip send, ack message
Prevents duplicate SMS charges on retry
```

---

## 1. Database Schema

### 1.1 New notification_logs Table
**File:** `packages/data-ops/src/drizzle/schema.ts` (add to existing)

```ts
export const notification_logs = pgTable("notification_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => auth_user.id, { onDelete: "cascade" }),
  addressId: integer("address_id").notNull().references(() => addresses.id, { onDelete: "cascade" }),
  notificationPreferenceId: integer("notification_preference_id").notNull().references(() => notification_preferences.id),
  wasteTypeIds: text("waste_type_ids").notNull(), // JSON array: "[1,2,3]"
  scheduledDate: text("scheduled_date").notNull(), // "2025-12-25"
  phoneNumber: text("phone_number").notNull(),
  smsContent: text("sms_content").notNull(),
  status: text("status").notNull(), // "pending" | "sent" | "failed" | "delivered"
  smsApiMessageId: text("sms_api_message_id"),
  smsApiStatus: text("sms_api_status"),
  costPln: integer("cost_pln"), // stored in grosze (1/100 PLN)
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("notification_logs_user_id_idx").on(table.userId),
  index("notification_logs_address_id_idx").on(table.addressId),
  index("notification_logs_scheduled_date_idx").on(table.scheduledDate),
  index("notification_logs_status_idx").on(table.status),
]);
```

### 1.2 Migration
```bash
cd packages/data-ops
pnpm run drizzle:dev:generate
pnpm run drizzle:dev:migrate
pnpm run build:data-ops
```

---

## 2. Data Layer

### 2.1 Notification Queries
**File:** `packages/data-ops/src/queries/notifications.ts` (new)

```ts
import { getDb } from "@/database/setup";
import { auth_user } from "@/drizzle/auth-schema";
import {
  addresses,
  cities,
  waste_schedules,
  waste_types,
  notification_preferences,
  notification_logs
} from "@/drizzle/schema";
import { eq, and, isNotNull } from "drizzle-orm";

// Validate Polish phone number: +48 followed by 9 digits
function isValidPolishPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, "");
  return /^\+48\d{9}$/.test(cleaned);
}

export async function getUsersNeedingNotification(
  currentHour: number, // 0-23 in CET/CEST
  currentMinute: number,
  targetDate: string // "2025-12-25"
) {
  const db = getDb();

  // Find waste schedules for target date
  const schedules = await db
    .select({
      cityId: waste_schedules.cityId,
      wasteTypeId: waste_schedules.wasteTypeId,
      wasteTypeName: waste_types.name,
      month: waste_schedules.month,
      days: waste_schedules.days,
    })
    .from(waste_schedules)
    .leftJoin(waste_types, eq(waste_schedules.wasteTypeId, waste_types.id));

  // Filter schedules matching target date
  const targetDay = new Date(targetDate).getDate();
  const targetMonth = new Date(targetDate).toLocaleString("pl-PL", { month: "long" });

  const relevantSchedules = schedules.filter(s => {
    const days = JSON.parse(s.days) as number[];
    return s.month === targetMonth && days.includes(targetDay);
  });

  // Group by cityId
  const schedulesByCity = relevantSchedules.reduce((acc, s) => {
    if (!acc[s.cityId]) acc[s.cityId] = [];
    acc[s.cityId].push({ wasteTypeId: s.wasteTypeId, wasteTypeName: s.wasteTypeName });
    return acc;
  }, {} as Record<number, Array<{ wasteTypeId: number; wasteTypeName: string }>>);

  const cityIds = Object.keys(schedulesByCity).map(Number);
  if (cityIds.length === 0) return [];

  // Fetch users with enabled notification preferences for current hour
  const users = await db
    .select({
      userId: auth_user.id,
      phone: auth_user.phone,
      addressId: addresses.id,
      cityId: addresses.cityId,
      cityName: cities.name,
      notificationPreferenceId: notification_preferences.id,
      notificationType: notification_preferences.notificationType,
    })
    .from(notification_preferences)
    .innerJoin(auth_user, eq(notification_preferences.userId, auth_user.id))
    .innerJoin(addresses, eq(notification_preferences.addressId, addresses.id))
    .leftJoin(cities, eq(addresses.cityId, cities.id))
    .where(
      and(
        eq(notification_preferences.enabled, true),
        eq(notification_preferences.hour, currentHour),
        isNotNull(auth_user.phone),
        isNotNull(addresses.cityId)
      )
    );

  // Filter users in relevant cities and validate phone numbers
  const now = new Date();
  const target = new Date(targetDate);

  return users
    .filter(u => u.cityId && cityIds.includes(u.cityId))
    .filter(u => u.phone && isValidPolishPhone(u.phone)) // Phone validation
    .map(u => {
      const daysDiff = Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isDayBefore = daysDiff === 1 && u.notificationType === "day_before";
      const isSameDay = daysDiff === 0 && u.notificationType === "same_day";

      if (!isDayBefore && !isSameDay) return null;

      return {
        userId: u.userId,
        phone: u.phone!.replace(/\s/g, ""), // Strip spaces
        addressId: u.addressId,
        cityId: u.cityId!,
        cityName: u.cityName!,
        notificationPreferenceId: u.notificationPreferenceId,
        notificationType: u.notificationType as "day_before" | "same_day",
        wasteTypes: schedulesByCity[u.cityId!],
      };
    })
    .filter(Boolean);
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
  smsApiMessageId?: string;
  smsApiStatus?: string;
  costPln?: number;
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
    smsApiStatus?: string;
    deliveredAt?: Date;
    errorMessage?: string;
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
```

### 2.2 Rebuild data-ops
```bash
pnpm run build:data-ops
```

---

## 3. SMSAPI.pl Integration

### 3.1 SMS Service
**File:** `apps/data-service/src/services/sms.ts` (new)

```ts
import { z } from "zod";

const SmsApiResponseSchema = z.object({
  count: z.number(),
  list: z.array(
    z.object({
      id: z.string(),
      points: z.number(),
      status: z.string(),
      error: z.number().optional(),
    })
  ),
});

// Validate Polish phone: +48 followed by 9 digits
export function isValidPolishPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, "");
  return /^\+48\d{9}$/.test(cleaned);
}

export async function sendSms(
  apiToken: string,
  phoneNumber: string,
  message: string,
  senderName?: string // Optional - uses default sender if omitted
): Promise<{ messageId: string; cost: number; status: string } | { error: string }> {
  try {
    const params = new URLSearchParams({
      to: phoneNumber,
      message: message,
      format: "json",
    });

    if (senderName) {
      params.append("from", senderName);
    }

    const response = await fetch("https://api.smsapi.pl/sms.do", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = SmsApiResponseSchema.parse(await response.json());
    const sms = data.list[0];

    if (sms.error) {
      return { error: `SMSAPI error code: ${sms.error}` };
    }

    return {
      messageId: sms.id,
      cost: sms.points, // SMSAPI uses "points" for cost
      status: sms.status,
    };
  } catch (error) {
    return { error: String(error) };
  }
}

export function formatWasteNotification(
  wasteTypes: string[],
  cityName: string,
  date: string,
  notificationType: "day_before" | "same_day"
): string {
  const typesList = wasteTypes.join(", ");

  if (notificationType === "day_before") {
    return `Przypomnienie: Jutro (${date}) wywóz śmieci w ${cityName}: ${typesList}.`;
  } else {
    return `Dzisiaj (${date}) wywóz śmieci w ${cityName}: ${typesList}.`;
  }
}
```

---

## 4. Cloudflare Queue Setup

### 4.1 Queue Configuration
**File:** `apps/data-service/wrangler.jsonc` (update)

```jsonc
{
  "name": "data-service",
  "main": "src/index.ts",
  "compatibility_date": "2025-04-01",
  "compatibility_flags": ["nodejs_compat"],

  // Add queue configuration
  "queues": {
    "producers": [
      { "queue": "notification-queue", "binding": "NOTIFICATION_QUEUE" }
    ],
    "consumers": [
      {
        "queue": "notification-queue",
        "max_batch_size": 10,
        "max_batch_timeout": 5,
        "max_retries": 3,
        "dead_letter_queue": "notification-dlq"
      }
    ]
  },

  // Add triggers - run every hour
  "triggers": {
    "crons": ["0 * * * *"]  // Every hour at minute 0
  },

  "observability": {
    "enabled": true
  },

  "env": {
    "stage": {
      "vars": {
        "ENVIRONMENT": "stage"
      }
    },
    "prod": {
      "vars": {
        "ENVIRONMENT": "prod"
      }
    }
  }
}
```

### 4.2 Update Worker Types
**File:** `apps/data-service/worker-configuration.d.ts` (update)

```ts
interface Env extends BaseEnv {
  NOTIFICATION_QUEUE: Queue<NotificationMessage>;
  SMSAPI_TOKEN: string;
  SMSAPI_SENDER_NAME?: string; // Optional - uses account default if not set
}

interface NotificationMessage {
  userId: string;
  phone: string;
  addressId: number;
  cityId: number;
  cityName: string;
  notificationPreferenceId: number;
  notificationType: "day_before" | "same_day";
  wasteTypes: Array<{ wasteTypeId: number; wasteTypeName: string }>;
  scheduledDate: string;
}
```

---

## 5. Cron Handler

### 5.1 Scheduled Handler
**File:** `apps/data-service/src/scheduled.ts` (new)

```ts
import { getUsersNeedingNotification } from "data-ops/queries/notifications";
import type { NotificationMessage } from "./worker-configuration";

export async function handleScheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();

  // Convert UTC to CET/CEST
  const month = now.getUTCMonth();
  const isSummerTime = month >= 3 && month <= 9; // April to October (simplified DST)
  const cetOffset = isSummerTime ? 2 : 1;
  const cetHour = (currentHour + cetOffset) % 24;

  console.log(`Cron triggered at UTC ${currentHour}:${currentMinute} = CET/CEST ${cetHour}:${currentMinute}`);

  // Check for day_before notifications (tomorrow's waste)
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const tomorrowUsers = await getUsersNeedingNotification(cetHour, currentMinute, tomorrowStr);

  // Check for same_day notifications (today's waste)
  const todayStr = now.toISOString().split("T")[0];
  const todayUsers = await getUsersNeedingNotification(cetHour, currentMinute, todayStr);

  const allUsers = [...tomorrowUsers, ...todayUsers];

  console.log(`Found ${allUsers.length} users to notify`);

  // Push messages to queue
  const batch: MessageSendRequest<NotificationMessage>[] = allUsers.map(user => ({
    body: {
      userId: user.userId,
      phone: user.phone,
      addressId: user.addressId,
      cityId: user.cityId,
      cityName: user.cityName,
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
```

---

## 6. Queue Consumer

### 6.1 Queue Handler
**File:** `apps/data-service/src/queue-consumer.ts` (new)

```ts
import { sendSms, formatWasteNotification, isValidPolishPhone } from "./services/sms";
import { createNotificationLog, updateNotificationStatus, getNotificationLog } from "data-ops/queries/notifications";
import type { NotificationMessage } from "./worker-configuration";

// Rate limiting: 10 req/s to stay under SMSAPI 100 req/s limit
const RATE_LIMIT_DELAY_MS = 100; // 10 SMS per second
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
        notificationPreferenceId,
        notificationType,
        wasteTypes,
        scheduledDate
      } = message.body;

      // Validate phone format before processing
      if (!isValidPolishPhone(phone)) {
        console.error(`Invalid phone format for user ${userId}: ${phone}`);
        message.ack(); // Don't retry - invalid data
        continue;
      }

      // Check if already sent (idempotency)
      const existingLog = await getNotificationLog(userId, addressId, scheduledDate, notificationPreferenceId);
      if (existingLog && (existingLog.status === "sent" || existingLog.status === "delivered")) {
        console.log(`Notification already sent for user ${userId}`);
        message.ack();
        continue;
      }

      // Format SMS content
      const wasteTypeNames = wasteTypes.map(w => w.wasteTypeName);
      const smsContent = formatWasteNotification(wasteTypeNames, cityName, scheduledDate, notificationType);

      // Create log entry
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

      // Rate limiting: wait before sending
      await sleep(RATE_LIMIT_DELAY_MS);

      // Send SMS
      const result = await sendSms(env.SMSAPI_TOKEN, phone, smsContent);

      if ("error" in result) {
        // Failed to send
        await updateNotificationStatus(log.id, "failed", {
          errorMessage: result.error,
        });
        message.retry(); // Retry later
      } else {
        // Sent successfully
        await updateNotificationStatus(log.id, "sent", {
          smsApiStatus: result.status,
          smsApiMessageId: result.messageId,
        });

        message.ack();
      }
    } catch (error) {
      console.error("Queue processing error:", error);
      message.retry();
    }
  }
}
```

---

## 7. Worker Entry Point

### 7.1 Update index.ts
**File:** `apps/data-service/src/index.ts` (update)

```ts
import { WorkerEntrypoint } from "cloudflare:workers";
import { app } from "@/hono/app";
import { handleScheduled } from "./scheduled";
import { handleQueue } from "./queue-consumer";

export default class DataService extends WorkerEntrypoint<Env> {
  fetch(request: Request) {
    return app.fetch(request, this.env, this.ctx);
  }

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    await handleScheduled(controller, env, ctx);
  }

  async queue(batch: MessageBatch) {
    await handleQueue(batch, this.env);
  }
}
```

---

## 8. Deployment

### 8.1 Set Secrets
```bash
# Required
wrangler secret put SMSAPI_TOKEN --env stage
wrangler secret put SMSAPI_TOKEN --env prod

# Optional (uses account default if omitted)
wrangler secret put SMSAPI_SENDER_NAME --env stage
wrangler secret put SMSAPI_SENDER_NAME --env prod
```

### 8.2 Create Queue
```bash
# Stage
wrangler queues create notification-queue --env stage
wrangler queues create notification-dlq --env stage

# Prod
wrangler queues create notification-queue --env prod
wrangler queues create notification-dlq --env prod
```

### 8.3 Deploy
```bash
pnpm run deploy:stage:data-service
pnpm run deploy:prod:data-service
```

---

## 9. Testing Flow

### 9.1 Local Testing

**Prerequisites:**
- `.dev.vars` in `apps/data-service/` with `SMSAPI_TOKEN` + `DATABASE_URL`
- `notification_logs` table migrated to dev DB

**Steps:**
1. Start wrangler: `wrangler dev` (supports queues + cron locally)
2. Trigger cron manually: `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"`
3. Queue auto-runs in-memory (wrangler simulates)
4. Check console logs for full flow
5. Query `notification_logs` table on Neon dev DB

**SMS Testing Options:**

**Option A: SMSAPI test mode** (recommended first)
- Add `test: "1"` param in `sendSms()` URLSearchParams
- Free, no actual send
- Returns fake message ID
- Update `sms.ts`:
  ```ts
  export async function sendSms(
    apiToken: string,
    phoneNumber: string,
    message: string,
    testMode = false
  ): Promise<{ messageId: string; cost: number; status: string } | { error: string }> {
    const params = new URLSearchParams({
      to: phoneNumber,
      message: message,
      format: "json",
    });

    if (testMode) {
      params.append("test", "1"); // Test mode - no send, returns fake ID
    }

    // ... rest unchanged
  }
  ```

**Option B: Real SMS**
- Use real SMSAPI token
- Send to test phone
- ~0.08 PLN per SMS

**Verification:**
- Console logs show: cron trigger → query users → queue batch → consumer process → SMS send
- `notification_logs` table tracks all attempts
- Check status: `pending` → `sent`/`failed`

### 9.2 Production Testing
1. Deploy to stage
2. Manually trigger cron via Cloudflare dashboard
3. Check logs: `wrangler tail --env stage`
4. Verify notification_logs table
5. Check SMS delivery on test phone

### 9.3 Monitoring
- Queue metrics in Cloudflare dashboard
- Notification logs in database
- Failed messages in DLQ
- SMS delivery reports from SMSAPI.pl

---

## 10. Critical Files

**Database:**
- `packages/data-ops/src/drizzle/schema.ts` - Add notification_logs table (UPDATE)

**Data Layer:**
- `packages/data-ops/src/queries/notifications.ts` - Notification queries (NEW)

**Backend:**
- `apps/data-service/src/index.ts` - Add scheduled/queue handlers (UPDATE)
- `apps/data-service/src/scheduled.ts` - Cron logic (NEW)
- `apps/data-service/src/queue-consumer.ts` - Queue processing (NEW)
- `apps/data-service/src/services/sms.ts` - SMSAPI.pl integration (NEW)

**Config:**
- `apps/data-service/wrangler.jsonc` - Add queues/crons (UPDATE)
- `apps/data-service/worker-configuration.d.ts` - Add types (UPDATE)

---

## 11. Execution Order

1. Create notification_logs table in schema.ts
2. Generate + apply migration
3. Create notification queries
4. Rebuild data-ops
5. Create SMS service
6. Update wrangler.jsonc (queues/hourly cron)
7. Update worker types
8. Create scheduled handler
9. Create queue consumer
10. Update worker index.ts
11. Create queues on Cloudflare
12. Set SMSAPI_TOKEN secret (optionally SMSAPI_SENDER_NAME)
13. Deploy to stage
14. Test end-to-end
15. Deploy to prod

---

## 12. Decisions

1. **Hourly cron** - Check notification_preferences table every hour
2. **Cron + Queues** over direct SMS for reliability/scale
3. **Single SMS per user** listing all waste types
4. **Store costs in grosze** (1/100 PLN) as integers
5. **Idempotency check** to prevent duplicate sends
6. **Dead letter queue** for permanent failures
7. **Batch size 10** for queue consumer (SMSAPI.pl rate limits)
8. **notification_preferences replaces notificationsEnabled** - more flexible
9. **Phone validation** - +48xxxxxxxxx format (9 digits). Validate in query + queue consumer
10. **Rate limiting** - 100ms delay between SMS sends (10/sec) to stay under SMSAPI 100 req/s limit

---

## 13. Key Changes from Original Design

1. **Removed notificationsEnabled field** - notification_preferences.enabled replaces it
2. **Hourly cron** instead of 4 fixed times (19:00, 7:00 in CET/CEST)
3. **Query notification_preferences** - supports customizable notification times
4. **notification_logs includes addressId + notificationPreferenceId** - tracks which address/preference triggered SMS
5. **getUsersNeedingNotification joins notification_preferences** - flexible hour matching

---

## 14. Cost Estimation

**SMSAPI.pl:**
- ~0.08 PLN per SMS
- 1000 users × 2 notifications/day × 30 days = 60,000 SMS/month
- Cost: ~4,800 PLN/month

**Cloudflare:**
- Queues: ~$0.40 per million operations (negligible)
- Worker CPU: Included in Workers plan
- Cron triggers: Free (runs 24x/day = 720x/month)

**Total:** ~5,000 PLN/month for 1000 active users

---

## 15. Verification Notes (2025-12-16)

### Corrected Issues:

1. **Scheduled handler signature** - Fixed to use `(controller: ScheduledController, env: Env, ctx: ExecutionContext)` per Cloudflare docs
2. **SMSAPI sender field** - Made optional (uses account default if not provided)
3. **Implementation status** - No notification_logs table exists in schema yet, no implementation in data-service

### Verified Correct:

1. **SMSAPI.pl endpoint** - `https://api.smsapi.pl/sms.do` with Bearer token auth confirmed
2. **Queue config syntax** - producers/consumers arrays format correct
3. **Cron syntax** - `triggers.crons` array correct
4. **Queue limits** - batch_size: 10, timeout: 5s, retries: 3 all within limits (100/60/100)
5. **MessageBatch API** - `message.ack()`, `message.retry()`, `Queue.sendBatch()` correct
6. **Request format** - `application/x-www-form-urlencoded` with `format=json` param correct

### Current State:

- Design doc complete but **NOT implemented**
- Missing: notification_logs table, queries, SMS service, scheduled/queue handlers
- data-service has no queue/cron config in wrangler.jsonc yet
