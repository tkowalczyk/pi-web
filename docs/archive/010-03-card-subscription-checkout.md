# Payment System - Card Subscription Checkout

**Parent Document:** [010-payments.md](010-payments.md)
**Version:** 1.0
**Status:** Ready for Implementation

---

## Overview

Implement card monthly subscription flow: checkout session endpoint + webhook handling for checkout.session.completed. Users can subscribe with card, get redirected to Stripe Checkout, and subscription created via webhook.

---

## Prerequisites

**Required:**
- [010-01-database-schema.md](010-01-database-schema.md) completed
- [010-02-stripe-setup.md](010-02-stripe-setup.md) completed
- Stripe customer creation working
- Card Monthly product/price in Stripe Dashboard

**Environment:**
- `STRIPE_CARD_MONTHLY_PRICE_ID` set in env vars

---

## Implementation

### 1. Backend - Checkout Session Endpoint

**File:** `apps/data-service/src/hono/routes/checkout.ts`

```typescript
import { Hono } from "hono";
import { getStripe } from "@/stripe/client";
import { getOrCreateStripeCustomer } from "@/stripe/customer";
import { getDb } from "@repo/data-ops/database/setup";
import { auth_user } from "@repo/data-ops/drizzle/auth-schema";
import { eq } from "drizzle-orm";

const checkout = new Hono<{ Bindings: Env }>();

checkout.post("/create-session", async (c) => {
  const body = await c.req.json();
  const { userId, priceId, successUrl, cancelUrl } = body;

  if (!userId || !priceId || !successUrl || !cancelUrl) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const db = getDb();
  const [user] = await db
    .select()
    .from(auth_user)
    .where(eq(auth_user.id, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(
    userId,
    user.email,
    user.name,
  );

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
    },
  });

  return c.json({ sessionUrl: session.url });
});

export default checkout;
```

**File:** `apps/data-service/src/hono/app.ts`

```typescript
import checkout from "@/hono/routes/checkout";

app.route("/api/checkout", checkout);
```

### 2. Backend - Webhook Handler

**File:** `apps/data-service/src/stripe/webhooks/checkout-session-completed.ts`

```typescript
import Stripe from "stripe";
import { getStripe } from "@/stripe/client";
import { getDb } from "@repo/data-ops/database/setup";
import { subscriptions, subscription_plans } from "@repo/data-ops/drizzle/schema";
import { eq } from "drizzle-orm";

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error("No userId in checkout session metadata");
    return;
  }

  const stripe = getStripe();
  const subscriptionId = session.subscription as string;

  if (!subscriptionId) {
    console.error("No subscription ID in checkout session");
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;

  if (!priceId) {
    console.error("No price ID in subscription");
    return;
  }

  const db = getDb();
  const [plan] = await db
    .select()
    .from(subscription_plans)
    .where(eq(subscription_plans.stripePriceId, priceId))
    .limit(1);

  if (!plan) {
    console.error(`No plan found for price ID: ${priceId}`);
    return;
  }

  const currentPeriodStart = new Date(subscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  await db.insert(subscriptions).values({
    userId,
    subscriptionPlanId: plan.id,
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    status: "active",
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
  });

  console.log(`Created subscription for user ${userId}`);
}
```

**File:** `apps/data-service/src/hono/routes/webhooks.ts`

```typescript
import { Hono } from "hono";
import { getStripe } from "@/stripe/client";
import Stripe from "stripe";
import { handleCheckoutSessionCompleted } from "@/stripe/webhooks/checkout-session-completed";

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

  console.log(`Webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`Error handling webhook ${event.type}:`, err);
    return c.json({ error: "Webhook handler failed" }, 500);
  }

  return c.json({ received: true });
});

export default webhooks;
```

**File:** `apps/data-service/src/hono/app.ts`

```typescript
import webhooks from "@/hono/routes/webhooks";

// IMPORTANT: Add BEFORE cors middleware
app.route("/webhooks", webhooks);

app.use("/*", cors({ /* ... */ }));
// ... rest of routes
```

### 3. Frontend - Pricing Button

**File:** `apps/user-application/src/components/pricing/card-subscription-button.tsx`

```typescript
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface Props {
  userId: string;
  disabled?: boolean;
}

export function CardSubscriptionButton({ userId, disabled }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);

    try {
      const response = await fetch("YOUR_DATA_SERVICE_URL/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          priceId: import.meta.env.VITE_STRIPE_CARD_MONTHLY_PRICE_ID,
          successUrl: window.location.origin + "/app/payment-success",
          cancelUrl: window.location.origin + "/app/payment-cancel",
        }),
      });

      const { sessionUrl } = await response.json();
      window.location.href = sessionUrl;
    } catch (err) {
      console.error("Failed to create checkout session:", err);
      alert("Payment failed. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading || disabled}>
      {loading ? "Loading..." : "Subscribe - Card Monthly"}
    </Button>
  );
}
```

### 4. Frontend - Success Page

**File:** `apps/user-application/src/routes/_auth/app/payment-success.tsx`

```typescript
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_auth/app/payment-success")({
  component: PaymentSuccess,
});

function PaymentSuccess() {
  const router = useRouter();

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">Your subscription is now active. You will receive SMS notifications.</p>
          <Button onClick={() => router.navigate({ to: "/app" })}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 5. Frontend - Cancel Page

**File:** `apps/user-application/src/routes/_auth/app/payment-cancel.tsx`

```typescript
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export const Route = createFileRoute("/_auth/app/payment-cancel")({
  component: PaymentCancel,
});

function PaymentCancel() {
  const router = useRouter();

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
            <XCircle className="h-10 w-10 text-orange-600" />
          </div>
          <CardTitle className="text-2xl">Payment Canceled</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">You can try again anytime.</p>
          <Button onClick={() => router.navigate({ to: "/app" })}>
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Environment Variables

### Development

**Backend:** `apps/data-service/.dev.vars`
```bash
STRIPE_CARD_MONTHLY_PRICE_ID=price_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_test_xxx
```

**Frontend:** `apps/user-application/.env`
```bash
VITE_STRIPE_CARD_MONTHLY_PRICE_ID=price_test_xxx
```

### Webhook Setup

Stripe Dashboard → Developers → Webhooks → Add endpoint
- URL: `http://localhost:8788/webhooks/stripe` (for local testing)
- Events: `checkout.session.completed`
- Copy webhook secret to .dev.vars

---

## Testing Strategy

### 1. Local Testing with Stripe CLI

```bash
# Terminal 1: Start worker
pnpm dev:data-service

# Terminal 2: Forward webhooks
stripe listen --forward-to http://localhost:8788/webhooks/stripe

# Terminal 3: Trigger test event
stripe trigger checkout.session.completed
```

### 2. End-to-End Test

1. Start frontend: `pnpm dev:user-application`
2. Start backend: `pnpm dev:data-service`
3. Start webhook forwarding: `stripe listen --forward-to http://localhost:8788/webhooks/stripe`
4. Click "Subscribe - Card Monthly" button
5. Redirected to Stripe Checkout
6. Enter test card: `4242424242424242`
7. Complete payment
8. Redirected to success page
9. Check console logs - webhook received
10. Check database - subscription created

### 3. Database Verification

```sql
SELECT
  s.id,
  s.status,
  s.current_period_start,
  s.current_period_end,
  sp.name as plan_name,
  u.email
FROM subscriptions s
JOIN subscription_plans sp ON s.subscription_plan_id = sp.id
JOIN auth_user u ON s.user_id = u.id
WHERE s.status = 'active';
```

### 4. Test Cases

| Test | Action | Expected |
|------|--------|----------|
| Valid card | Enter 4242424242424242 | Payment succeeds, subscription created |
| Declined card | Enter 4000000000000002 | Payment fails, no subscription |
| Cancel checkout | Click back button | Redirected to cancel page |
| Webhook retry | Trigger same event twice | Idempotent (no duplicate subscription) |
| Invalid signature | Modify webhook payload | Webhook rejected |

---

## Acceptance Criteria

- [ ] Checkout endpoint creates session
- [ ] User redirected to Stripe Checkout
- [ ] Test card completes payment
- [ ] Webhook endpoint receives checkout.session.completed
- [ ] Signature verification passes
- [ ] Subscription record created in database
- [ ] Status = "active"
- [ ] currentPeriodEnd = 1 month from start
- [ ] Success page loads after payment
- [ ] Cancel page loads if user cancels
- [ ] No duplicate subscriptions on webhook retry
- [ ] Error handling works (invalid user, missing plan)

---

## Next Steps

After completion, proceed to:
- [010-04-webhook-infrastructure.md](010-04-webhook-infrastructure.md) - Complete webhook handlers

---

## References

- Main doc: [010-payments.md](010-payments.md) Section 5.1, 5.3, 5.4
- Stripe Checkout: https://stripe.com/docs/payments/checkout
- Stripe Webhooks: https://stripe.com/docs/webhooks
