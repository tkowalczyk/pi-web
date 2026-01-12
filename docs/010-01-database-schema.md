# Payment System - Database Schema

**Parent Document:** [010-payments.md](010-payments.md)
**Version:** 1.0
**Status:** Ready for Implementation

---

## Overview

Database schema for payment system including subscription plans, subscriptions, payments, and extensions to auth_user table.

---

## Prerequisites

**Dependencies:**
- None (first component to implement)

**Required Tools:**
- Drizzle ORM installed
- Database migrations enabled for dev/stage/prod

---

## Schema Changes

### New Tables

#### subscription_plans

```typescript
export const subscription_plans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  stripeProductId: text("stripe_product_id").notNull().unique(),
  stripePriceId: text("stripe_price_id").notNull().unique(),
  currency: text("currency").notNull().default("PLN"),
  amount: integer("amount").notNull(),
  interval: text("interval").notNull(),
  intervalCount: integer("interval_count").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  paymentMethod: text("payment_method").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("subscription_plans_stripe_product_id_idx").on(table.stripeProductId),
  index("subscription_plans_stripe_price_id_idx").on(table.stripePriceId),
]);
```

#### subscriptions

```typescript
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => auth_user.id, { onDelete: "cascade" }),
  subscriptionPlanId: integer("subscription_plan_id").notNull().references(() => subscription_plans.id, { onDelete: "restrict" }),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull(),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("subscriptions_user_id_idx").on(table.userId),
  index("subscriptions_stripe_customer_id_idx").on(table.stripeCustomerId),
  index("subscriptions_stripe_subscription_id_idx").on(table.stripeSubscriptionId),
  index("subscriptions_stripe_payment_intent_id_idx").on(table.stripePaymentIntentId),
  index("subscriptions_status_idx").on(table.status),
  index("subscriptions_current_period_end_idx").on(table.currentPeriodEnd),
]);
```

**Status Values:**
- `active` - Subscription active, user receives SMS
- `past_due` - Payment failed, user does NOT receive SMS
- `canceled` - User canceled, still active until currentPeriodEnd
- `expired` - Subscription expired, user does NOT receive SMS

#### payments

```typescript
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => auth_user.id, { onDelete: "cascade" }),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  stripePaymentIntentId: text("stripe_payment_intent_id").notNull().unique(),
  stripeChargeId: text("stripe_charge_id"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("PLN"),
  status: text("status").notNull(),
  paymentMethod: text("payment_method").notNull(),
  failureCode: text("failure_code"),
  failureMessage: text("failure_message"),
  receiptUrl: text("receipt_url"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("payments_user_id_idx").on(table.userId),
  index("payments_subscription_id_idx").on(table.subscriptionId),
  index("payments_stripe_payment_intent_id_idx").on(table.stripePaymentIntentId),
  index("payments_status_idx").on(table.status),
  index("payments_paid_at_idx").on(table.paidAt),
]);
```

**Status Values:**
- `pending` - Payment initiated but not completed
- `succeeded` - Payment successful
- `failed` - Payment failed

### Auth User Extension

Add to existing auth_user table:

```typescript
export const auth_user = pgTable("auth_user", {
  // ... existing fields
  stripeCustomerId: text("stripe_customer_id"),
  // ...
}, (table) => [
  // ... existing indexes
  index("auth_user_stripe_customer_id_idx").on(table.stripeCustomerId),
]);
```

---

## Implementation Steps

### 1. Update Schema File

**File:** `packages/data-ops/src/drizzle/schema.ts`

Add the three new tables.

### 2. Update Auth Schema

**File:** `packages/data-ops/src/drizzle/auth-schema.ts`

Add stripeCustomerId field and index.

### 3. Generate Migrations

```bash
cd packages/data-ops
pnpm run drizzle:dev:generate
```

Review generated SQL in `packages/data-ops/src/drizzle/migrations/dev/`

### 4. Apply Migrations

```bash
pnpm run drizzle:dev:migrate
```

### 5. Create Seed Script

**File:** `packages/data-ops/src/seed/subscription-plans.ts`

```typescript
import { getDb } from "../database/setup";
import { subscription_plans } from "../drizzle/schema";

export async function seedSubscriptionPlans() {
  const db = getDb();

  await db.insert(subscription_plans).values([
    {
      name: "Card Monthly",
      stripeProductId: process.env.STRIPE_CARD_MONTHLY_PRODUCT_ID!,
      stripePriceId: process.env.STRIPE_CARD_MONTHLY_PRICE_ID!,
      currency: "PLN",
      amount: 1000, // 10.00 PLN
      interval: "month",
      intervalCount: 1,
      paymentMethod: "card",
      description: "Monthly subscription with card - PLN 10/month",
    },
    {
      name: "BLIK Annual",
      stripeProductId: process.env.STRIPE_BLIK_ANNUAL_PRODUCT_ID!,
      stripePriceId: process.env.STRIPE_BLIK_ANNUAL_PRICE_ID!,
      currency: "PLN",
      amount: 10000, // 100.00 PLN
      interval: "year",
      intervalCount: 1,
      paymentMethod: "blik",
      description: "Annual payment with BLIK - PLN 100/year (save 2 months)",
    },
  ]);

  console.log("Subscription plans seeded successfully");
}
```

Note: Seed with placeholder IDs. Update after Stripe setup.

### 6. Rebuild data-ops

```bash
cd packages/data-ops
pnpm build
```

Or from root:
```bash
pnpm build:data-ops
```

---

## Testing Strategy

### Manual Testing

1. **Verify Tables Created**
```sql
SELECT * FROM subscription_plans;
SELECT * FROM subscriptions;
SELECT * FROM payments;
SELECT stripe_customer_id FROM auth_user LIMIT 1;
```

2. **Test Relationships**
```sql
-- Insert test subscription plan
INSERT INTO subscription_plans (name, stripe_product_id, stripe_price_id, amount, interval, payment_method)
VALUES ('Test Plan', 'prod_test', 'price_test', 1000, 'month', 'card');

-- Insert test subscription (requires existing user)
INSERT INTO subscriptions (user_id, subscription_plan_id, stripe_customer_id, status, current_period_start, current_period_end)
VALUES ('existing_user_id', 1, 'cus_test', 'active', NOW(), NOW() + INTERVAL '1 month');

-- Query joined data
SELECT
  s.id,
  s.status,
  sp.name as plan_name,
  sp.amount,
  u.email
FROM subscriptions s
JOIN subscription_plans sp ON s.subscription_plan_id = sp.id
JOIN auth_user u ON s.user_id = u.id;
```

3. **Test Indexes**
```sql
EXPLAIN ANALYZE SELECT * FROM subscriptions WHERE user_id = 'test_user_id';
EXPLAIN ANALYZE SELECT * FROM subscriptions WHERE stripe_subscription_id = 'sub_test';
EXPLAIN ANALYZE SELECT * FROM payments WHERE stripe_payment_intent_id = 'pi_test';
```

4. **Test Cascading Deletes**
```sql
-- Create test user with subscription
-- Delete user
-- Verify subscription and payments deleted
```

---

## Acceptance Criteria

- [ ] All tables created successfully
- [ ] Foreign key constraints working (cascade/restrict)
- [ ] Indexes created on all referenced columns
- [ ] auth_user.stripeCustomerId field added
- [ ] Migration runs without errors in dev
- [ ] Seed script creates 2 subscription plans
- [ ] Can query joined data (subscriptions + plans + users)
- [ ] Cascade delete works (user deletion removes subscriptions/payments)
- [ ] Rebuild data-ops completes without errors
- [ ] Apps can import schema types

---

## Rollout to Other Environments

### Stage

```bash
cd packages/data-ops
pnpm run drizzle:stage:generate
pnpm run drizzle:stage:migrate
# Update seed with stage Stripe IDs
pnpm run seed:stage
```

### Production

```bash
cd packages/data-ops
pnpm run drizzle:prod:generate
pnpm run drizzle:prod:migrate
# Update seed with LIVE Stripe IDs
pnpm run seed:prod
```

---

## References

- Main doc: [010-payments.md](010-payments.md) Section 3
- Drizzle schema location: `packages/data-ops/src/drizzle/schema.ts`
- Auth schema location: `packages/data-ops/src/drizzle/auth-schema.ts`
