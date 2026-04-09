# Payment System - Webhook Infrastructure

**Parent Document:** [010-payments.md](010-payments.md)
**Version:** 1.0
**Status:** Ready for Implementation

---

## Overview

Complete webhook infrastructure with all event handlers: subscription updates, deletions, invoice events, and idempotency tracking.

---

## Prerequisites

**Required:**
- [010-01-database-schema.md](010-01-database-schema.md) completed
- [010-02-stripe-setup.md](010-02-stripe-setup.md) completed
- [010-03-card-subscription-checkout.md](010-03-card-subscription-checkout.md) completed
- Webhook endpoint exists with checkout.session.completed handler

---

## Implementation

**Pattern Note:** All DB operations must go through query functions in `packages/data-ops/src/queries/`. Webhook handlers import these functions, never do direct DB calls. This matches codebase patterns (see [cache-stats.ts](../apps/data-service/src/kv/cache-stats.ts)).

### 1. Idempotency Tracking (Optional but Recommended)

**File:** `packages/data-ops/src/drizzle/schema.ts`

```typescript
export const webhook_events = pgTable("webhook_events", {
  id: text("id").primaryKey(), // Stripe event ID
  type: text("type").notNull(),
  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Generate migration:
```bash
cd packages/data-ops
pnpm drizzle:dev:generate
pnpm drizzle:dev:migrate
pnpm build
```

**File:** `packages/data-ops/src/queries/webhook-events.ts`

```typescript
import { getDb } from "@/database/setup";
import { webhook_events } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function isEventProcessed(eventId: string): Promise<boolean> {
  const db = getDb();
  const [event] = await db
    .select()
    .from(webhook_events)
    .where(eq(webhook_events.id, eventId))
    .limit(1);

  return event?.processed || false;
}

export async function markEventProcessed(eventId: string, eventType: string): Promise<void> {
  const db = getDb();
  await db.insert(webhook_events).values({
    id: eventId,
    type: eventType,
    processed: true,
  }).onConflictDoNothing();
}
```

### 2. Add Subscription Queries

**File:** `packages/data-ops/src/queries/subscription.ts`

Add these functions:

```typescript
export async function updateSubscriptionByStripeId(
  stripeSubscriptionId: string,
  data: {
    status: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: Date | null;
  }
) {
  const db = getDb();
  await db
    .update(subscriptions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

export async function getSubscriptionByStripeId(stripeSubscriptionId: string) {
  const db = getDb();
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return sub;
}

export async function cancelSubscription(stripeSubscriptionId: string) {
  const db = getDb();
  await db
    .update(subscriptions)
    .set({
      status: "canceled",
      canceledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}
```

Rebuild data-ops:
```bash
cd packages/data-ops
pnpm build
```

### 3. Add Payment Queries

**File:** `packages/data-ops/src/queries/payment.ts` (new file)

```typescript
import { getDb } from "@/database/setup";
import { payments } from "@/drizzle/schema";

interface CreatePaymentData {
  userId: string;
  subscriptionId: number;
  stripePaymentIntentId: string;
  stripeChargeId?: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  receiptUrl?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  paidAt: Date | null;
}

export async function createPayment(data: CreatePaymentData) {
  const db = getDb();
  const [payment] = await db.insert(payments).values(data).returning();
  return payment;
}
```

Rebuild data-ops:
```bash
cd packages/data-ops
pnpm build
```

### 4. Subscription Updated Handler

**File:** `apps/data-service/src/stripe/webhooks/subscription-updated.ts`

```typescript
import Stripe from "stripe";
import { updateSubscriptionByStripeId } from "@repo/data-ops/queries/subscription";

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const status = subscription.status === "active" || subscription.status === "trialing"
    ? "active"
    : subscription.status === "past_due"
    ? "past_due"
    : subscription.status === "canceled" || subscription.status === "incomplete_expired"
    ? "canceled"
    : "expired";

  await updateSubscriptionByStripeId(subscription.id, {
    status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
  });

  console.log(`Updated subscription ${subscription.id} to status ${status}`);
}
```

### 5. Subscription Deleted Handler

**File:** `apps/data-service/src/stripe/webhooks/subscription-deleted.ts`

```typescript
import Stripe from "stripe";
import { cancelSubscription } from "@repo/data-ops/queries/subscription";

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await cancelSubscription(subscription.id);
  console.log(`Deleted subscription ${subscription.id}`);
}
```

### 6. Invoice Payment Succeeded Handler

**File:** `apps/data-service/src/stripe/webhooks/invoice-payment-succeeded.ts`

```typescript
import Stripe from "stripe";
import { getSubscriptionByStripeId } from "@repo/data-ops/queries/subscription";
import { createPayment } from "@repo/data-ops/queries/payment";

export async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    console.error("No subscription ID in invoice");
    return;
  }

  const subscription = await getSubscriptionByStripeId(subscriptionId);

  if (!subscription) {
    console.error(`No subscription found for ID: ${subscriptionId}`);
    return;
  }

  await createPayment({
    userId: subscription.userId,
    subscriptionId: subscription.id,
    stripePaymentIntentId: invoice.payment_intent as string,
    stripeChargeId: invoice.charge as string,
    amount: invoice.amount_paid,
    currency: invoice.currency.toUpperCase(),
    status: "succeeded",
    paymentMethod: "card",
    receiptUrl: invoice.hosted_invoice_url,
    paidAt: new Date(),
  });

  console.log(`Logged recurring payment for subscription ${subscriptionId}`);
}
```

### 7. Invoice Payment Failed Handler

**File:** `apps/data-service/src/stripe/webhooks/invoice-payment-failed.ts`

```typescript
import Stripe from "stripe";
import { getSubscriptionByStripeId, updateSubscriptionByStripeId } from "@repo/data-ops/queries/subscription";
import { createPayment } from "@repo/data-ops/queries/payment";

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    console.error("No subscription ID in invoice");
    return;
  }

  const subscription = await getSubscriptionByStripeId(subscriptionId);

  if (!subscription) {
    console.error(`No subscription found for ID: ${subscriptionId}`);
    return;
  }

  await updateSubscriptionByStripeId(subscriptionId, {
    status: "past_due",
  });

  await createPayment({
    userId: subscription.userId,
    subscriptionId: subscription.id,
    stripePaymentIntentId: invoice.payment_intent as string,
    amount: invoice.amount_due,
    currency: invoice.currency.toUpperCase(),
    status: "failed",
    paymentMethod: "card",
    failureCode: invoice.last_finalization_error?.code,
    failureMessage: invoice.last_finalization_error?.message,
    paidAt: null,
  });

  console.log(`Payment failed for subscription ${subscriptionId}`);
}
```

### 8. Update Webhook Route

**File:** `apps/data-service/src/hono/routes/webhooks.ts`

```typescript
import { Hono } from "hono";
import { getStripe } from "@/stripe/client";
import Stripe from "stripe";
import { handleCheckoutSessionCompleted } from "@/stripe/webhooks/checkout-session-completed";
import { handleSubscriptionUpdated } from "@/stripe/webhooks/subscription-updated";
import { handleSubscriptionDeleted } from "@/stripe/webhooks/subscription-deleted";
import { handleInvoicePaymentSucceeded } from "@/stripe/webhooks/invoice-payment-succeeded";
import { handleInvoicePaymentFailed } from "@/stripe/webhooks/invoice-payment-failed";
import { isEventProcessed, markEventProcessed } from "@repo/data-ops/queries/webhook-events";

const webhooks = new Hono<{ Bindings: Env }>();

webhooks.post("/stripe", async (c) => {
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json({ error: "No signature" }, 400);
  }

  const body = await c.req.text();
  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return c.json({ error: "Invalid signature" }, 400);
  }

  console.log(`Webhook received: ${event.type} (${event.id})`);

  // Check idempotency
  if (await isEventProcessed(event.id)) {
    console.log(`Event ${event.id} already processed, skipping`);
    return c.json({ received: true, skipped: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark as processed
    await markEventProcessed(event.id, event.type);
  } catch (err) {
    console.error(`Error handling webhook ${event.type}:`, err);
    return c.json({ error: "Webhook handler failed" }, 500);
  }

  return c.json({ received: true });
});

export default webhooks;
```

---

## Stripe Dashboard Webhook Configuration

### Development (Local)

Use Stripe CLI:
```bash
stripe listen --forward-to http://localhost:8788/webhooks/stripe
```

Copy webhook secret to `.dev.vars`

### Stage

Stripe Dashboard → Developers → Webhooks → Add endpoint
- URL: `https://your-stage-worker.workers.dev/webhooks/stripe`
- Events to select:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Copy webhook secret

Set as Cloudflare secret:
```bash
wrangler secret put STRIPE_WEBHOOK_SECRET --env stage
```

### Production

Same as stage but with production URL and live mode webhook secret.

---

## Testing Strategy

### 1. Test with Stripe CLI

```bash
# Terminal 1: Start worker
pnpm dev:data-service

# Terminal 2: Forward webhooks
stripe listen --forward-to http://localhost:8788/webhooks/stripe

# Terminal 3: Trigger events
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
```

### 2. Test Idempotency

```bash
# Send same event twice
stripe trigger checkout.session.completed
stripe trigger checkout.session.completed

# Check logs - second should skip
# Check database - only one subscription created
```

### 3. Test Subscription Lifecycle

1. Create card subscription (checkout.session.completed)
2. Verify subscription status = "active"
3. Trigger subscription.updated with past_due status
4. Verify database status = "past_due"
5. Trigger subscription.deleted
6. Verify database status = "canceled"

### 4. Test Invoice Events

1. Create active subscription
2. Trigger invoice.payment_succeeded
3. Verify payment record created with status "succeeded"
4. Trigger invoice.payment_failed
5. Verify:
   - Payment record created with status "failed"
   - Subscription status updated to "past_due"

### 5. Database Verification

```sql
-- Check webhook event tracking
SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 10;

-- Check subscription status changes
SELECT id, status, current_period_end, updated_at
FROM subscriptions
ORDER BY updated_at DESC;

-- Check payment records
SELECT id, status, payment_method, amount, paid_at
FROM payments
ORDER BY created_at DESC;
```

---

## Acceptance Criteria

**Data-ops queries:**
- [ ] Subscription queries added to `packages/data-ops/src/queries/subscription.ts`
- [ ] Payment queries created in `packages/data-ops/src/queries/payment.ts`
- [ ] data-ops rebuilt after adding queries

**Webhook handlers:**
- [ ] All 5 webhook handlers implemented
- [ ] All handlers use data-ops query functions (no direct DB calls)
- [ ] Idempotency tracking table created
- [ ] Event deduplication works (same event twice = no duplicate)
- [ ] subscription.updated changes status correctly
- [ ] subscription.deleted marks subscription canceled
- [ ] invoice.payment_succeeded creates payment record
- [ ] invoice.payment_failed updates status to past_due
- [ ] All handlers log to console
- [ ] Error handling returns 500 (Stripe retries)
- [ ] Signature verification rejects invalid webhooks

**Configuration:**
- [ ] Webhook endpoint configured in Stripe Dashboard
- [ ] Test events trigger successfully via Stripe CLI

---

## Error Handling

All handlers include:
- Null checks (subscription ID, user ID, etc.)
- Console logging
- Database transaction safety
- Stripe retry compatibility (500 on error)

Monitor logs for:
```
Error handling webhook [event_type]
```

Set up alerts for repeated failures.

---

## Next Steps

After completion, proceed to:
- [010-05-sms-gating.md](010-05-sms-gating.md) - Gate SMS notifications by subscription status

---

## References

- Main doc: [010-payments.md](010-payments.md) Section 5.3, 5.4
- Stripe webhook events: https://stripe.com/docs/api/events
- Stripe CLI: https://stripe.com/docs/stripe-cli
