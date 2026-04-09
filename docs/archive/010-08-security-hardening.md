# Payment System - Security Hardening

**Parent Document:** [010-payments.md](010-payments.md)
**Version:** 1.0
**Status:** Ready for Implementation

---

## Overview

Security enhancements: duplicate payment prevention, webhook idempotency enforcement, validation checks, error handling improvements.

---

## Prerequisites

**Required:**
- All previous parts completed (010-01 through 010-07)
- Basic payment flows working
- Webhooks receiving events

**Testing Environment:**
- Ability to trigger duplicate events
- Test user accounts with various states

---

## Security Threats & Mitigations

### 1. Duplicate Payment Prevention

**Threat:** User creates multiple checkout sessions/payment intents by clicking button repeatedly or browser back button.

**Current Risk:** Multiple subscriptions for same user.

**Mitigation:**

**File:** `apps/data-service/src/hono/routes/checkout.ts`

```typescript
import { getActiveSubscription } from "@repo/data-ops/queries/subscriptions";

checkout.post("/create-session", async (c) => {
  const body = await c.req.json();
  const { userId, priceId, successUrl, cancelUrl } = body;

  // Validation
  if (!userId || !priceId || !successUrl || !cancelUrl) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  // NEW: Check for existing active subscription
  const existingSubscription = await getActiveSubscription(userId);
  if (existingSubscription) {
    return c.json(
      {
        error: "User already has active subscription",
        subscriptionId: existingSubscription.id,
        expiresAt: existingSubscription.currentPeriodEnd,
      },
      400
    );
  }

  // ... rest of existing code
});

checkout.post("/create-payment-intent", async (c) => {
  const body = await c.req.json();
  const { userId, priceId, returnUrl } = body;

  // Validation
  if (!userId || !priceId || !returnUrl) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  // NEW: Check for existing active subscription
  const existingSubscription = await getActiveSubscription(userId);
  if (existingSubscription) {
    return c.json(
      {
        error: "User already has active subscription",
        subscriptionId: existingSubscription.id,
        expiresAt: existingSubscription.currentPeriodEnd,
      },
      400
    );
  }

  // ... rest of existing code
});
```

### 2. Webhook Idempotency Enforcement

**Threat:** Stripe sends duplicate webhook events (network issues, retries).

**Current Risk:** Duplicate subscription/payment records.

**Mitigation:** Already implemented in 010-04, but enforce more strictly:

**File:** `apps/data-service/src/hono/routes/webhooks.ts`

```typescript
// At start of webhook handler, BEFORE event processing

if (await isEventProcessed(event.id)) {
  console.log(`[IDEMPOTENCY] Event ${event.id} already processed, skipping`);
  return c.json({ received: true, skipped: true });
}

// ... process event ...

// After successful processing
await markEventProcessed(event.id, event.type);
```

### 3. Webhook Signature Verification

**Threat:** Attacker sends fake webhook to grant free subscriptions.

**Current Risk:** Unauthorized subscription creation.

**Mitigation:** Already implemented, but add logging:

**File:** `apps/data-service/src/hono/routes/webhooks.ts`

```typescript
try {
  event = stripe.webhooks.constructEvent(
    body,
    signature,
    c.env.STRIPE_WEBHOOK_SECRET
  );
} catch (err) {
  console.error("[SECURITY] Webhook signature verification failed:", {
    error: err.message,
    signature: signature.substring(0, 20) + "...",
    ip: c.req.header("cf-connecting-ip"),
  });
  return c.json({ error: "Invalid signature" }, 400);
}
```

### 4. User ID Validation

**Threat:** User modifies userId in API requests to access others' subscriptions.

**Current Risk:** Unauthorized subscription creation for other users.

**Mitigation:**

**File:** `apps/data-service/src/hono/routes/checkout.ts`

```typescript
checkout.post("/create-session", async (c) => {
  const body = await c.req.json();
  const { userId, priceId, successUrl, cancelUrl } = body;

  // NEW: Verify userId matches authenticated session
  const sessionUserId = c.get("userId"); // From auth middleware
  if (userId !== sessionUserId) {
    console.error("[SECURITY] User ID mismatch:", {
      provided: userId,
      session: sessionUserId,
      ip: c.req.header("cf-connecting-ip"),
    });
    return c.json({ error: "Unauthorized" }, 403);
  }

  // ... rest of code
});
```

### 5. Subscription Status Validation

**Threat:** Race condition where SMS sent before webhook updates expired status.

**Current Risk:** Free user receives SMS briefly after expiry.

**Mitigation:** Already handled in 010-05 with timestamp check:

```typescript
and(
  eq(subscriptions.status, "active"),
  gte(subscriptions.currentPeriodEnd, now) // <-- Critical check
)
```

### 6. Amount Validation

**Threat:** Attacker modifies payment amount client-side.

**Current Risk:** Pay PLN 1 for annual subscription.

**Mitigation:** Amount determined server-side only:

**File:** `apps/data-service/src/hono/routes/checkout.ts`

```typescript
// NEVER accept amount from client
// Amount from subscription_plans table ONLY

const [plan] = await db
  .select()
  .from(subscription_plans)
  .where(eq(subscription_plans.stripePriceId, priceId))
  .limit(1);

if (!plan) {
  return c.json({ error: "Invalid plan" }, 400);
}

// Use plan.amount (server-side trusted value)
const paymentIntent = await stripe.paymentIntents.create({
  amount: plan.amount, // <-- From database, not client
  // ...
});
```

### 7. Metadata Validation in Webhooks

**Threat:** Webhook metadata tampered with.

**Current Risk:** Subscription created for wrong user.

**Mitigation:** Validate metadata presence:

**File:** `apps/data-service/src/stripe/webhooks/checkout-session-completed.ts`

```typescript
export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error("[WEBHOOK ERROR] No userId in checkout session metadata", {
      sessionId: session.id,
      customer: session.customer,
    });
    // Do NOT create subscription without userId
    return;
  }

  // Verify user exists
  const db = getDb();
  const [user] = await db
    .select()
    .from(auth_user)
    .where(eq(auth_user.id, userId))
    .limit(1);

  if (!user) {
    console.error("[WEBHOOK ERROR] User not found in database", {
      userId,
      sessionId: session.id,
    });
    return;
  }

  // ... rest of code
}
```

### 8. Database Constraints

**Threat:** Application bug allows duplicate subscriptions.

**Current Risk:** Multiple active subscriptions per user.

**Mitigation:** Add unique constraint (optional, enforces at DB level):

**File:** `packages/data-ops/src/drizzle/schema.ts`

```typescript
export const subscriptions = pgTable("subscriptions", {
  // ... existing fields
}, (table) => [
  // ... existing indexes
  // NEW: Prevent multiple active subscriptions per user
  index("subscriptions_user_status_idx").on(table.userId, table.status),
]);

// Optional: Add unique partial index (PostgreSQL only)
// CREATE UNIQUE INDEX subscriptions_active_user_idx
// ON subscriptions (user_id)
// WHERE status = 'active' AND current_period_end > NOW();
```

For stricter enforcement, apply migration manually:

```sql
CREATE UNIQUE INDEX subscriptions_active_user_idx
ON subscriptions (user_id)
WHERE status = 'active' AND current_period_end > NOW();
```

---

## Error Handling Improvements

### 1. Detailed Error Logging

**File:** `apps/data-service/src/stripe/webhooks/utils.ts`

```typescript
export function logWebhookError(
  eventType: string,
  eventId: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  console.error(`[WEBHOOK ERROR] ${eventType}`, {
    eventId,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
  });
}
```

Use in handlers:

```typescript
try {
  await handleCheckoutSessionCompleted(session);
} catch (err) {
  logWebhookError("checkout.session.completed", event.id, err, {
    sessionId: session.id,
    userId: session.metadata?.userId,
  });
  throw err; // Re-throw for Stripe retry
}
```

### 2. Graceful Degradation

**File:** `apps/user-application/src/routes/_auth/app/index.tsx`

```typescript
const { data: subscription, error } = useSuspenseQuery({
  queryKey: ["subscription"],
  queryFn: () => getMySubscription(),
  retry: 3,
  retryDelay: 1000,
});

if (error) {
  // Show error state but don't block entire dashboard
  return (
    <div className="p-4 bg-destructive/10 text-destructive rounded-md">
      Failed to load subscription status. Please refresh.
    </div>
  );
}
```

---

## Rate Limiting (Optional)

Protect checkout endpoints from abuse:

**File:** `apps/data-service/src/middleware/rate-limit.ts`

```typescript
import { Hono } from "hono";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return async (c, next) => {
    const ip = c.req.header("cf-connecting-ip") || "unknown";
    const now = Date.now();

    const record = rateLimitStore.get(ip);

    if (record && now < record.resetAt) {
      if (record.count >= maxRequests) {
        return c.json({ error: "Too many requests" }, 429);
      }
      record.count++;
    } else {
      rateLimitStore.set(ip, {
        count: 1,
        resetAt: now + windowMs,
      });
    }

    await next();
  };
}
```

Apply to checkout routes:

```typescript
import { rateLimit } from "@/middleware/rate-limit";

checkout.post("/create-session", rateLimit(5, 60000), async (c) => {
  // 5 requests per minute per IP
  // ... handler code
});
```

---

## Testing Strategy

### 1. Duplicate Payment Prevention

**Test:** Try to create checkout session with existing active subscription.

```bash
# User has active subscription
curl -X POST http://localhost:8788/api/checkout/create-session \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_with_active_sub",
    "priceId": "price_test_xxx",
    "successUrl": "http://localhost:3000/success",
    "cancelUrl": "http://localhost:3000/cancel"
  }'

# Expected: 400 error with "User already has active subscription"
```

### 2. Webhook Idempotency

**Test:** Send same webhook event twice.

```bash
stripe trigger checkout.session.completed
# Wait for processing
stripe trigger checkout.session.completed --override checkout_session:id=same_session_id

# Expected:
# - First: Subscription created
# - Second: Skipped (idempotency check)
# - Database: Only 1 subscription
```

### 3. Invalid Webhook Signature

**Test:** Modify webhook payload.

```bash
curl -X POST http://localhost:8788/webhooks/stripe \
  -H "stripe-signature: invalid_signature" \
  -d '{"fake": "data"}'

# Expected: 400 error "Invalid signature"
```

### 4. User ID Mismatch

**Test:** User A tries to create subscription for User B.

```bash
# Logged in as user_a
curl -X POST http://localhost:8788/api/checkout/create-session \
  -H "Cookie: session=user_a_session" \
  -d '{"userId": "user_b", ...}'

# Expected: 403 Unauthorized
```

### 5. Metadata Validation

**Test:** Webhook with missing userId metadata.

```bash
# Manually create checkout session without metadata
# Trigger webhook
# Expected: Webhook logs error, no subscription created
```

### 6. Amount Tampering (Impossible Test)

Client cannot modify amount - validated by testing that:
- Checkout session always uses plan.amount from database
- Payment intent always uses plan.amount from database
- Client never sends amount field

---

## Monitoring & Alerts

### Cloudflare Logs

Monitor for:
- `[SECURITY]` log entries (signature failures, user ID mismatches)
- `[WEBHOOK ERROR]` entries (webhook processing failures)
- `[IDEMPOTENCY]` entries (duplicate event detections)

### Stripe Dashboard

Monitor:
- Webhook delivery failures (Dashboard → Developers → Webhooks)
- Failed payments (Dashboard → Payments)
- Refund requests (Dashboard → Payments → Refunds)

### Database Monitoring

```sql
-- Check for users with multiple active subscriptions
SELECT user_id, COUNT(*) as count
FROM subscriptions
WHERE status = 'active' AND current_period_end > NOW()
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Should return 0 rows
```

---

## Acceptance Criteria

- [ ] Duplicate payment prevention works (400 error if active subscription exists)
- [ ] Webhook idempotency enforced (duplicate events skipped)
- [ ] Invalid webhook signatures rejected
- [ ] User ID validation prevents unauthorized access
- [ ] Metadata validation in webhooks (no subscription without userId)
- [ ] Amount always from server-side plan, never client
- [ ] Error logging includes context (event ID, user ID, timestamp)
- [ ] Database constraints prevent application bugs
- [ ] Rate limiting protects against abuse (optional)
- [ ] Monitoring logs capture security events
- [ ] Test suite covers all security scenarios

---

## Security Checklist

**Stripe:**
- [ ] Webhook secret stored as Cloudflare secret (not in code)
- [ ] Signature verification enabled
- [ ] Test mode keys separate from production

**Database:**
- [ ] Foreign key constraints enforced
- [ ] Timestamps track all mutations
- [ ] Sensitive data not logged (secrets, full card numbers)

**API:**
- [ ] User ID validated against session
- [ ] Duplicate subscriptions prevented
- [ ] Amount validation server-side only
- [ ] Rate limiting applied (optional)

**Webhooks:**
- [ ] Idempotency tracking enabled
- [ ] Metadata validation enforced
- [ ] Error logging comprehensive
- [ ] Retry-safe (idempotent handlers)

---

## Production Readiness

Before deploying to production:

1. **Review all secrets:**
   - `STRIPE_SECRET_KEY` (live mode)
   - `STRIPE_WEBHOOK_SECRET` (prod endpoint)
   - Database credentials

2. **Test webhook endpoint:**
   - Configure in Stripe Dashboard (prod URL)
   - Test with live test card (small amount)
   - Verify subscription created

3. **Monitor logs for 24 hours:**
   - Check for security warnings
   - Verify webhook processing
   - Validate no duplicate subscriptions

4. **Set up alerts:**
   - Webhook failures > 5 in 1 hour
   - Security log entries
   - Database constraint violations

---

## Next Steps

All payment system components complete. Final deployment checklist:

- [ ] All 8 parts implemented and tested
- [ ] Migrations applied to stage/prod
- [ ] Stripe products/prices created (live mode)
- [ ] Webhook endpoints configured (prod URLs)
- [ ] Secrets set in Cloudflare Workers
- [ ] End-to-end test with real payment (small amount)
- [ ] Monitoring active
- [ ] SMS gating verified (only paid users receive SMS)

---

## References

- Main doc: [010-payments.md](010-payments.md) Section 8, 11
- Stripe security best practices: https://stripe.com/docs/security
- Cloudflare Workers secrets: https://developers.cloudflare.com/workers/configuration/secrets/
