# Payment System - BLIK Annual Payment Flow

**Parent Document:** [010-payments.md](010-payments.md)
**Version:** 1.0
**Status:** Ready for Implementation

---

## Overview

Implement BLIK annual payment flow using Payment Intent API and Stripe Payment Element. Users pay PLN 100 for 1 year, one-time payment (no recurring).

---

## Prerequisites

**Required:**
- [010-01-database-schema.md](010-01-database-schema.md) completed
- [010-02-stripe-setup.md](010-02-stripe-setup.md) completed
- [010-04-webhook-infrastructure.md](010-04-webhook-infrastructure.md) completed
- BLIK enabled in Stripe Dashboard (Settings → Payment methods)
- BLIK Annual product/price created in Stripe

**Environment:**
- `STRIPE_BLIK_ANNUAL_PRICE_ID` set in env vars

---

## Implementation

### 1. Data-ops - Payment Queries

**File:** `packages/data-ops/src/queries/payments.ts`

```typescript
import { getDb } from "../database/setup";
import { auth_user, subscription_plans, subscriptions, payments } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export async function getUserById(userId: string) {
  const db = getDb();
  const [user] = await db
    .select()
    .from(auth_user)
    .where(eq(auth_user.id, userId))
    .limit(1);
  return user;
}

export async function getPlanByPriceId(priceId: string) {
  const db = getDb();
  const [plan] = await db
    .select()
    .from(subscription_plans)
    .where(eq(subscription_plans.stripePriceId, priceId))
    .limit(1);
  return plan;
}

export async function getPlanById(planId: number) {
  const db = getDb();
  const [plan] = await db
    .select()
    .from(subscription_plans)
    .where(eq(subscription_plans.id, planId))
    .limit(1);
  return plan;
}

interface CreateBlikSubscriptionParams {
  userId: string;
  subscriptionPlanId: number;
  stripeCustomerId: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  stripeChargeId?: string;
  receiptUrl?: string;
}

export async function createBlikSubscription({
  userId,
  subscriptionPlanId,
  stripeCustomerId,
  stripePaymentIntentId,
  amount,
  currency,
  stripeChargeId,
  receiptUrl,
}: CreateBlikSubscriptionParams) {
  const db = getDb();

  const currentPeriodStart = new Date();
  const currentPeriodEnd = new Date();
  currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);

  const [subscription] = await db.insert(subscriptions).values({
    userId,
    subscriptionPlanId,
    stripeCustomerId,
    stripePaymentIntentId,
    status: "active",
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: false,
  }).returning();

  await db.insert(payments).values({
    userId,
    subscriptionId: subscription.id,
    stripePaymentIntentId,
    stripeChargeId,
    amount,
    currency,
    status: "succeeded",
    paymentMethod: "blik",
    receiptUrl,
    paidAt: new Date(),
  });

  return subscription;
}
```

**File:** `packages/data-ops/src/queries/index.ts` (add exports)

```typescript
export * from "./payments";
```

After creating queries, rebuild data-ops:
```bash
pnpm build:data-ops
```

### 2. Backend - Payment Intent Endpoint

**File:** `apps/data-service/src/hono/routes/checkout.ts` (add to existing)

```typescript
import { getUserById, getPlanByPriceId } from "@repo/data-ops/queries/payments";

checkout.post("/create-payment-intent", async (c) => {
  const body = await c.req.json();
  const { userId, priceId, returnUrl } = body;

  if (!userId || !priceId || !returnUrl) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const user = await getUserById(userId);
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const plan = await getPlanByPriceId(priceId);
  if (!plan) {
    return c.json({ error: "Plan not found" }, 404);
  }

  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(
    userId,
    user.email,
    user.name
  );

  const paymentIntent = await stripe.paymentIntents.create({
    amount: plan.amount,
    currency: plan.currency.toLowerCase(),
    customer: customerId,
    payment_method_types: ["blik"],
    metadata: {
      userId,
      subscriptionPlanId: plan.id.toString(),
    },
    return_url: returnUrl,
  });

  return c.json({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  });
});
```

### 3. Backend - Payment Intent Webhook Handler

**File:** `apps/data-service/src/stripe/webhooks/payment-intent-succeeded.ts`

```typescript
import Stripe from "stripe";
import { getPlanById, createBlikSubscription } from "@repo/data-ops/queries/payments";

export async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata?.userId;
  const subscriptionPlanId = paymentIntent.metadata?.subscriptionPlanId;

  if (!userId || !subscriptionPlanId) {
    console.error("Missing metadata in payment intent");
    return;
  }

  const plan = await getPlanById(parseInt(subscriptionPlanId));
  if (!plan) {
    console.error(`No plan found for ID: ${subscriptionPlanId}`);
    return;
  }

  await createBlikSubscription({
    userId,
    subscriptionPlanId: plan.id,
    stripeCustomerId: paymentIntent.customer as string,
    stripePaymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency.toUpperCase(),
    stripeChargeId: paymentIntent.charges.data[0]?.id,
    receiptUrl: paymentIntent.charges.data[0]?.receipt_url,
  });

  console.log(`Created BLIK annual subscription for user ${userId}`);
}
```

**File:** `apps/data-service/src/hono/routes/webhooks.ts` (add handler)

```typescript
import { handlePaymentIntentSucceeded } from "@/stripe/webhooks/payment-intent-succeeded";

// In switch statement:
case "payment_intent.succeeded":
  await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
  break;
```

### 4. Frontend - Install Stripe React

```bash
pnpm add @stripe/stripe-js @stripe/react-stripe-js --filter user-application
```

### 5. Frontend - BLIK Payment Page

**File:** `apps/user-application/src/routes/_auth/app/payment/blik.tsx`

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export const Route = createFileRoute("/_auth/app/payment/blik")({
  component: BlikPaymentPage,
});

interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

function BlikPaymentPage() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (): Promise<PaymentIntentResponse> => {
      const response = await fetch(`${import.meta.env.VITE_DATA_SERVICE_URL}/api/checkout/create-payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "USER_ID_FROM_SESSION", // TODO: Get from session
          priceId: import.meta.env.VITE_STRIPE_BLIK_ANNUAL_PRICE_ID,
          returnUrl: window.location.origin + "/app/payment-success",
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to create payment intent");
      }
      return response.json();
    },
    onSuccess: ({ clientSecret }) => {
      setClientSecret(clientSecret);
    },
    onError: (err) => {
      console.error("Failed to create payment intent:", err);
      alert("Failed to initialize payment. Please try again.");
    },
  });

  // Trigger payment intent creation on mount
  if (!clientSecret && !mutation.isPending && !mutation.isError) {
    mutation.mutate();
  }

  if (mutation.isPending || !clientSecret) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center">Loading payment...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mutation.isError) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">Failed to initialize payment</p>
            <Button onClick={() => mutation.mutate()} className="mt-4 w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>BLIK Annual Payment</CardTitle>
          <CardDescription>
            Pay PLN 100 for 1 year of SMS notifications (save PLN 20 vs monthly)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <BlikPaymentForm />
          </Elements>
        </CardContent>
      </Card>
    </div>
  );
}

function BlikPaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + "/app/payment-success",
      },
    });

    if (submitError) {
      setError(submitError.message || "Payment failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && (
        <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
          {error}
        </div>
      )}
      <Button
        type="submit"
        className="w-full mt-6"
        disabled={!stripe || loading}
      >
        {loading ? "Processing..." : "Pay 70 PLN"}
      </Button>
    </form>
  );
}
```

### 6. Frontend - Add Navigation

**File:** `apps/user-application/src/components/pricing/blik-payment-button.tsx`

```typescript
import { Button } from "@/components/ui/button";
import { useRouter } from "@tanstack/react-router";
import { Calendar } from "lucide-react";

export function BlikPaymentButton() {
  const router = useRouter();

  return (
    <Button onClick={() => router.navigate({ to: "/app/payment/blik" })}>
      <Calendar className="mr-2 h-4 w-4" />
      Pay with BLIK - Annual
    </Button>
  );
}
```

---

## Environment Variables

### Development

**Backend:** `apps/data-service/.dev.vars`
```bash
STRIPE_BLIK_ANNUAL_PRICE_ID=price_test_yyy
```

**Frontend:** `apps/user-application/.env`
```bash
VITE_STRIPE_BLIK_ANNUAL_PRICE_ID=price_test_yyy
```

### Webhook Events

Add to Stripe webhook endpoint:
- `payment_intent.succeeded`
- `payment_intent.payment_failed` (optional - for error handling)

---

## Testing Strategy

### 1. Test with Stripe Test Mode

**BLIK Test Code:** `000000` (six zeros)

No mobile app approval needed in test mode.

### 2. End-to-End Test

1. Start services:
   - Frontend: `pnpm dev:user-application`
   - Backend: `pnpm dev:data-service`
   - Webhooks: `stripe listen --forward-to http://localhost:8788/webhooks/stripe`

2. Navigate to `/app/payment/blik`

3. Payment Element loads, shows BLIK option

4. Enter BLIK code: `000000`

5. Click "Pay 100 PLN"

6. Payment succeeds immediately (test mode)

7. Webhook `payment_intent.succeeded` received

8. Check console logs - subscription created

9. Redirected to success page

10. Verify database:
```sql
SELECT
  s.id,
  s.status,
  s.current_period_start,
  s.current_period_end,
  EXTRACT(YEAR FROM AGE(s.current_period_end, s.current_period_start)) as years,
  sp.name,
  p.payment_method,
  p.amount
FROM subscriptions s
JOIN subscription_plans sp ON s.subscription_plan_id = sp.id
LEFT JOIN payments p ON p.subscription_id = s.id
WHERE s.stripe_payment_intent_id IS NOT NULL
ORDER BY s.created_at DESC;
```

Expected:
- status = "active"
- years = 1
- payment_method = "blik"
- amount = 10000 (PLN 100)

### 3. Test Cases

| Test | Action | Expected |
|------|--------|----------|
| Valid BLIK | Enter 000000 | Payment succeeds, 1-year subscription |
| Invalid BLIK | Enter 123456 | Error shown, can retry |
| User doesn't approve | Don't approve in app (prod only) | Payment pending, timeout after 2min |
| Already has subscription | User with active sub | Block payment (handled in 010-08) |
| Webhook failure | Kill webhook server | Payment succeeds but no subscription (edge case) |

### 4. BLIK-Specific Checks

- [ ] Payment Element shows BLIK option (requires Polish locale detection)
- [ ] BLIK code input accepts 6 digits only
- [ ] Test code 000000 works in test mode
- [ ] Payment succeeds immediately in test mode
- [ ] Subscription period = exactly 1 year from payment
- [ ] No recurring subscription created (stripeSubscriptionId is NULL)
- [ ] Payment record has method = "blik"

---

## Edge Cases

### 1. Payment Succeeds But Webhook Fails

**Scenario:** User pays, webhook never received or fails processing.

**Detection:** User sees success but no subscription in DB.

**Mitigation:**
- Stripe retries webhooks for 3 days
- Add "pending subscription" check on success page
- Manual reconciliation via Stripe Dashboard if needed

### 2. User Closes Browser During Payment

**Scenario:** User enters BLIK code but closes browser before approval.

**Result:** Payment Intent remains in `requires_action` state.

**Handling:** User can restart payment, Stripe creates new Payment Intent.

### 3. BLIK Payment Limits

**Stripe Limit:** PLN 3000 per transaction (well above PLN 100).

**No Impact:** Our pricing within limits.

---

## Acceptance Criteria

- [ ] Payment queries created in data-ops package
- [ ] data-ops rebuilt after adding queries
- [ ] Payment Intent endpoint uses data-ops queries
- [ ] Webhook handler uses data-ops queries
- [ ] Frontend uses TanStack mutation for payment intent
- [ ] Payment Intent endpoint creates intent with BLIK
- [ ] Frontend Payment Element shows BLIK option
- [ ] Test BLIK code 000000 completes payment
- [ ] Webhook payment_intent.succeeded received
- [ ] Subscription created with 1-year period
- [ ] stripePaymentIntentId populated (not stripeSubscriptionId)
- [ ] Payment record created with method = "blik"
- [ ] Receipt URL saved
- [ ] Success page loads after payment
- [ ] User can receive SMS after BLIK payment
- [ ] No recurring billing setup (one-time only)

---

## Polish Market Context

**BLIK Popularity:**
- 60%+ of Polish online payments use BLIK
- Instant payment via mobile banking app
- No card details needed
- Preferred over card for one-time payments

**Strategy:**
- Promote BLIK annual as primary option
- PLN 20 savings incentive
- Better cash flow (1 year upfront vs monthly)

---

## Next Steps

After completion, proceed to:
- [010-07-frontend-subscription-status.md](010-07-frontend-subscription-status.md) - Dashboard status display

---

## References

- Main doc: [010-payments.md](010-payments.md) Section 5.2
- Stripe BLIK docs: https://stripe.com/docs/payments/blik
- Stripe Payment Element: https://stripe.com/docs/payments/payment-element
- Stripe Payment Intents: https://stripe.com/docs/payments/payment-intents
