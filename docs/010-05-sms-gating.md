# Payment System - SMS Notification Gating

**Parent Document:** [010-payments.md](010-payments.md)
**Version:** 1.0
**Status:** Ready for Implementation

---

## Overview

Modify notification system to check subscription status before sending SMS. Only users with active paid subscriptions receive SMS notifications.

---

## Prerequisites

**Required:**
- [010-01-database-schema.md](010-01-database-schema.md) completed
- [010-02-stripe-setup.md](010-02-stripe-setup.md) completed
- [010-03-card-subscription-checkout.md](010-03-card-subscription-checkout.md) completed
- [010-04-webhook-infrastructure.md](010-04-webhook-infrastructure.md) completed
- Active subscriptions exist in database for testing

**Existing System:**
- Cloudflare Cron runs hourly
- Calls `getUsersNeedingNotification()` query
- Sends SMS via SerwerSMS API

---

## Implementation

### 1. Subscription Status Queries

**File:** `packages/data-ops/src/queries/subscriptions.ts`

```typescript
import { getDb } from "@/database/setup";
import { subscriptions } from "@/drizzle/schema";
import { eq, and, gte, inArray } from "drizzle-orm";

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const db = getDb();
  const now = new Date();

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
        gte(subscriptions.currentPeriodEnd, now)
      )
    )
    .limit(1);

  return !!subscription;
}

export async function getActiveUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const db = getDb();
  const now = new Date();

  const activeSubscriptions = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.userId, userIds),
        eq(subscriptions.status, "active"),
        gte(subscriptions.currentPeriodEnd, now)
      )
    );

  return new Set(activeSubscriptions.map(s => s.userId));
}
```

Rebuild data-ops:
```bash
cd packages/data-ops
pnpm build
```

### 2. Modify Notification Query

**File:** `packages/data-ops/src/queries/notifications.ts`

**Option A: Batch Check (Recommended - More Efficient)**

```typescript
import { getActiveUserIds } from "./subscriptions";

export async function getUsersNeedingNotification(
  currentHour: number,
  currentMinute: number,
  targetDate: string
) {
  const db = getDb();

  // ... EXISTING QUERY LOGIC TO GET USERS ...
  // (Keep all existing code that fetches users, addresses, preferences, schedules)

  // NEW: Batch check active subscriptions
  const userIds = users.map(u => u.userId);
  const activeUserIds = await getActiveUserIds(userIds);

  // NEW: Filter to only users with active subscriptions
  return users
    .filter(u => activeUserIds.has(u.userId))
    .filter(u => {
      const key = `${u.cityId}-${u.streetId}`;
      return u.cityId && u.streetId && schedulesByCityStreet[key];
    })
    .filter(u => u.phone && isValidPolishPhone(u.phone))
    .map(u => {
      // ... EXISTING MAPPING LOGIC ...
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);
}
```

**Option B: Individual Check (Simpler but Slower)**

```typescript
import { hasActiveSubscription } from "./subscriptions";

export async function getUsersNeedingNotification(
  currentHour: number,
  currentMinute: number,
  targetDate: string
) {
  const db = getDb();

  // ... EXISTING QUERY LOGIC TO GET USERS ...

  // NEW: Filter users with active subscriptions
  const usersWithSubscription = [];

  for (const user of users) {
    if (await hasActiveSubscription(user.userId)) {
      usersWithSubscription.push(user);
    }
  }

  return usersWithSubscription
    .filter(u => {
      const key = `${u.cityId}-${u.streetId}`;
      return u.cityId && u.streetId && schedulesByCityStreet[key];
    })
    .filter(u => u.phone && isValidPolishPhone(u.phone))
    .map(u => {
      // ... EXISTING MAPPING LOGIC ...
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);
}
```

Rebuild data-ops:
```bash
pnpm build:data-ops
```

### 3. No Changes Needed to Cron Handler

**File:** `apps/data-service/src/scheduled/index.ts`

Existing cron logic remains unchanged. It calls `getUsersNeedingNotification()` which now returns only paid users.

---

## Testing Strategy

### 1. Setup Test Data

Create test users with different subscription statuses:

```sql
-- User 1: Active subscription
INSERT INTO subscriptions (user_id, subscription_plan_id, stripe_customer_id, status, current_period_start, current_period_end)
VALUES ('user_active_123', 1, 'cus_test1', 'active', NOW(), NOW() + INTERVAL '1 month');

-- User 2: Expired subscription
INSERT INTO subscriptions (user_id, subscription_plan_id, stripe_customer_id, status, current_period_start, current_period_end)
VALUES ('user_expired_123', 1, 'cus_test2', 'expired', NOW() - INTERVAL '2 months', NOW() - INTERVAL '1 month');

-- User 3: Past due
INSERT INTO subscriptions (user_id, subscription_plan_id, stripe_customer_id, status, current_period_start, current_period_end)
VALUES ('user_past_due_123', 1, 'cus_test3', 'past_due', NOW() - INTERVAL '1 month', NOW() + INTERVAL '5 days');

-- User 4: No subscription
-- (just existing auth_user record, no subscription)
```

### 2. Test Query Directly

```typescript
// In dev console or test script
import { getActiveUserIds } from "@repo/data-ops/queries/subscriptions";

const userIds = ["user_active_123", "user_expired_123", "user_past_due_123", "user_no_sub_123"];
const activeIds = await getActiveUserIds(userIds);

console.log(activeIds);
// Expected: Set { "user_active_123" }
```

### 3. Test Cron Manually

Trigger cron via Cloudflare dashboard or:

```bash
# Use wrangler to trigger scheduled event
wrangler dev --test-scheduled

# Or use Cloudflare dashboard → Workers → Triggers → Cron Triggers → Run Now
```

Monitor logs:
```
[Cron] Processing notifications for [hour]:[minute]
Users needing notification: 5
(Only users with active subscriptions)
```

### 4. Verify SMS Sending

Check SerwerSMS logs or database notification_logs:

```sql
SELECT
  nl.id,
  nl.user_id,
  nl.phone,
  nl.sent_at,
  s.status as subscription_status
FROM notification_logs nl
LEFT JOIN subscriptions s ON nl.user_id = s.user_id AND s.status = 'active'
ORDER BY nl.sent_at DESC
LIMIT 10;
```

All records should have subscription_status = 'active'.

### 5. Test Edge Cases

| User Status | Subscription Status | Period End | Should Receive SMS |
|-------------|---------------------|------------|-------------------|
| Active sub | active | Future | ✅ Yes |
| Active sub | active | Today (before midnight) | ✅ Yes |
| Active sub | active | Yesterday | ❌ No (expired) |
| Past due | past_due | Future | ❌ No |
| Canceled | canceled | Future | ❌ No (hard cutoff) |
| No subscription | N/A | N/A | ❌ No |
| Multiple subs | active (one) + expired (one) | Future (active) | ✅ Yes |

---

## Performance Considerations

### Batch Query Performance

**Before (without subscription check):**
- Query: ~100ms for 1000 users
- Filters: address + phone + schedule matching

**After (with batch subscription check):**
- Query: ~150ms for 1000 users
- Additional: 1 batch subscription query (~20ms)
- Total: ~170ms

**Optimization:**
- Index on `subscriptions(user_id, status, current_period_end)` already exists
- Batch query more efficient than N individual queries
- No impact on cron execution time

### Monitoring

Add timing logs:

```typescript
const start = Date.now();
const users = await getUsersNeedingNotification(hour, minute, date);
const duration = Date.now() - start;

console.log(`[Cron] Query completed in ${duration}ms, ${users.length} users`);
```

Alert if duration > 5000ms.

---

## Business Logic Validation

### Subscription Status → SMS Permission

| Status | Period End | SMS Allowed |
|--------|------------|-------------|
| `active` | Future | ✅ Yes |
| `active` | Past | ❌ No |
| `past_due` | Any | ❌ No |
| `canceled` | Any | ❌ No |
| `expired` | Any | ❌ No |

**Hard Cutoff:** No grace period. User loses SMS immediately on expiry.

**Multiple Addresses:** 1 subscription covers all user addresses.

---

## Acceptance Criteria

- [ ] Subscription query functions created
- [ ] getUsersNeedingNotification() modified with subscription check
- [ ] data-ops rebuilt successfully
- [ ] Test: User with active subscription receives SMS
- [ ] Test: User with expired subscription does NOT receive SMS
- [ ] Test: User with past_due subscription does NOT receive SMS
- [ ] Test: User without subscription does NOT receive SMS
- [ ] Test: Query performance acceptable (< 500ms for 1000 users)
- [ ] Cron logs show filtered user count
- [ ] No SMS sent to free users
- [ ] Existing SMS functionality unchanged (message content, timing, etc.)

---

## Rollback Plan

If issues occur:

1. **Disable subscription check:**
```typescript
// Temporarily comment out filter
// .filter(u => activeUserIds.has(u.userId))
```

2. **Deploy hotfix**
3. **All users receive SMS again** (revert to pre-payment behavior)
4. **Fix issue and redeploy**

---

## Next Steps

After completion, proceed to:
- [010-06-blik-payment-flow.md](010-06-blik-payment-flow.md) - BLIK annual payment implementation

---

## References

- Main doc: [010-payments.md](010-payments.md) Section 6
- Existing notification query: `packages/data-ops/src/queries/notifications.ts`
- Cron handler: `apps/data-service/src/scheduled/index.ts`
