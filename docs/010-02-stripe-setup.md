# Payment System - Stripe Setup

**Parent Document:** [010-payments.md](010-payments.md)
**Version:** 1.0
**Status:** Ready for Implementation

---

## Overview

Initialize Stripe SDK, implement customer creation, verify basic API connectivity. No payment flows yet - just foundation.

---

## Prerequisites

**Required:**
- [010-01-database-schema.md](010-01-database-schema.md) completed
- auth_user.stripeCustomerId field exists

**Stripe Account:**
- Test mode enabled
- API keys accessible

---

## Stripe Dashboard Configuration

### 1. Enable Payment Methods

Dashboard → Settings → Payment methods:
- [x] Card payments (enabled by default)
- [x] BLIK (enable for Polish market)

### 2. Create Test Products & Prices

**Product 1: Card Monthly**
- Name: `powiadomienia.info - Card Monthly`
- Pricing: Recurring, PLN 10/month
- Copy: Product ID (`prod_xxx`), Price ID (`price_xxx`)

**Product 2: BLIK Annual**
- Name: `powiadomienia.info - BLIK Annual`
- Pricing: One-time, PLN 100
- Copy: Product ID (`prod_yyy`), Price ID (`price_yyy`)

---

## Implementation

### 1. Install Stripe SDK

```bash
pnpm add stripe --filter data-service
```

### 2. Stripe Client

**File:** `apps/data-service/src/stripe/client.ts`

```typescript
import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function initStripe(secretKey: string): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    });
  }
  return stripeClient;
}

export function getStripe(): Stripe {
  if (!stripeClient) {
    throw new Error('Stripe client not initialized');
  }
  return stripeClient;
}
```

### 3. Initialize on Worker Start

**File:** `apps/data-service/src/index.ts`

```typescript
import { WorkerEntrypoint } from "cloudflare:workers";
import { app } from "@/hono/app";
import { initDatabase } from "@repo/data-ops/database/setup";
import { initStripe } from "@/stripe/client";
import { handleScheduled } from "./scheduled";
import { handleQueue } from "./queues";

export default class DataService extends WorkerEntrypoint<Env> {
  constructor(ctx: ExecutionContext, env: Env) {
    super(ctx, env);
    initDatabase({
      host: env.DATABASE_HOST,
      username: env.DATABASE_USERNAME,
      password: env.DATABASE_PASSWORD,
    });
    initStripe(env.STRIPE_SECRET_KEY); // NEW
  }

  fetch(request: Request) {
    return app.fetch(request, this.env, this.ctx);
  }

  async scheduled(controller: ScheduledController) {
    await handleScheduled(controller, this.env, this.ctx);
  }

  async queue(batch: MessageBatch<NotificationMessage>) {
    await handleQueue(batch, this.env);
  }
}
```

### 4. Customer Creation Query

**File:** `packages/data-ops/src/queries/stripe-customer.ts`

```typescript
import { getDb } from "@/database/setup";
import { auth_user } from "@/drizzle/auth-schema";
import { eq } from "drizzle-orm";

export async function getUserStripeCustomerId(userId: string): Promise<string | null> {
  const db = getDb();

  const [user] = await db
    .select({ stripeCustomerId: auth_user.stripeCustomerId })
    .from(auth_user)
    .where(eq(auth_user.id, userId))
    .limit(1);

  return user?.stripeCustomerId || null;
}

export async function saveStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
  const db = getDb();

  await db
    .update(auth_user)
    .set({ stripeCustomerId, updatedAt: new Date() })
    .where(eq(auth_user.id, userId));
}
```

Rebuild data-ops after:
```bash
pnpm build:data-ops
```

### 5. Customer Creation Logic

**File:** `apps/data-service/src/stripe/customer.ts`

```typescript
import { getStripe } from "./client";
import { getUserStripeCustomerId, saveStripeCustomerId } from "@repo/data-ops/queries/stripe-customer";

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name: string
): Promise<string> {
  const existingCustomerId = await getUserStripeCustomerId(userId);

  if (existingCustomerId) {
    return existingCustomerId;
  }

  const stripe = getStripe();

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      userId,
    },
  });

  await saveStripeCustomerId(userId, customer.id);

  return customer.id;
}
```

### 6. Test Endpoint

**File:** `apps/data-service/src/hono/routes/test-stripe.ts`

```typescript
import { Hono } from "hono";
import { getOrCreateStripeCustomer } from "@/stripe/customer";

const testStripe = new Hono<{ Bindings: Env }>();

testStripe.post("/create-customer", async (c) => {
  const body = await c.req.json();
  const { userId, email, name } = body;

  if (!userId || !email || !name) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  try {
    const customerId = await getOrCreateStripeCustomer(userId, email, name);
    return c.json({ success: true, customerId });
  } catch (err) {
    console.error("Customer creation failed:", err);
    return c.json({ error: "Failed to create customer" }, 500);
  }
});

export default testStripe;
```

**File:** `apps/data-service/src/hono/app.ts`

```typescript
import testStripe from "@/hono/routes/test-stripe";

// Add route
app.route("/test-stripe", testStripe);
```

---

## Environment Variables

### Development

**File:** `apps/data-service/.dev.vars`

```bash
# Existing vars...
STRIPE_SECRET_KEY=sk_test_xxx
```

Get from: Stripe Dashboard → Developers → API keys → Secret key (Test mode)

### Stage/Prod

Set as Cloudflare secret:

```bash
wrangler secret put STRIPE_SECRET_KEY --env stage
# Enter: sk_test_xxx

wrangler secret put STRIPE_SECRET_KEY --env prod
# Enter: sk_live_xxx (later)
```

---

## Testing Strategy

### 1. Unit Test - Client Initialization

```bash
pnpm dev:data-service
```

Check logs - no errors on worker start.

### 2. Manual Test - Customer Creation

```bash
curl -X POST http://localhost:8788/test-stripe/create-customer \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "email": "test@example.com",
    "name": "Test User"
  }'
```

Expected response:
```json
{
  "success": true,
  "customerId": "cus_xxxxxxxxxxxxx"
}
```

### 3. Verify in Stripe Dashboard

Dashboard → Customers → Search for "test@example.com"
- Customer exists
- Metadata contains userId

### 4. Verify in Database

```sql
SELECT stripe_customer_id FROM auth_user WHERE id = 'test_user_123';
```

Should return: `cus_xxxxxxxxxxxxx`

### 5. Test Idempotency

Call same endpoint again:
```bash
curl -X POST http://localhost:8788/test-stripe/create-customer \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "email": "test@example.com",
    "name": "Test User"
  }'
```

Should return SAME customer ID (no duplicate created).

### 6. Test Error Handling

```bash
# Invalid Stripe key
# Expected: 500 error, logged to console

# Missing fields
curl -X POST http://localhost:8788/test-stripe/create-customer \
  -H "Content-Type: application/json" \
  -d '{"userId": "test"}'
# Expected: 400 error
```

---

## Acceptance Criteria

- [ ] Stripe SDK installed
- [ ] initStripe() called on worker start
- [ ] No errors on worker initialization
- [ ] Test endpoint creates Stripe customer
- [ ] Customer ID saved to auth_user table
- [ ] Customer visible in Stripe Dashboard
- [ ] Metadata includes userId
- [ ] Second call returns existing customer (no duplicate)
- [ ] Error handling works (invalid key, missing fields)
- [ ] Products & Prices created in Stripe Dashboard
- [ ] BLIK payment method enabled

---

## Cleanup

After testing, remove test endpoint:

1. Delete `apps/data-service/src/hono/routes/test-stripe.ts`
2. Remove route from `apps/data-service/src/hono/app.ts`

---

## Next Steps

After completion, proceed to:
- [010-03-card-subscription-checkout.md](010-03-card-subscription-checkout.md) - Card subscription flow

---

## References

- Main doc: [010-payments.md](010-payments.md) Section 4
- Stripe customer API: https://stripe.com/docs/api/customers
