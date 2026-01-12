# Payment System - Implementation Plan

**Parent Document:** [010-payments.md](010-payments.md)
**Version:** 1.0
**Date:** 2026-01-12

---

## Overview

Main payment system design document split into 8 independent, testable parts. Each part can be implemented, tested, and verified independently.

---

## Document Structure

### [010-01-database-schema.md](010-01-database-schema.md)
**Focus:** Database schema only

**Scope:**
- subscription_plans table
- subscriptions table
- payments table
- auth_user.stripeCustomerId extension
- Migrations and seed scripts

**Prerequisites:** None

**Testing:** SQL queries, table creation verification, relationship checks

**Est. Time:** 2-3 hours

---

### [010-02-stripe-setup.md](010-02-stripe-setup.md)
**Focus:** Stripe SDK initialization and customer creation

**Scope:**
- Install Stripe SDK
- Initialize client on worker start
- Customer creation logic
- Basic API connectivity test

**Prerequisites:** 010-01 completed

**Testing:** Create test customer, verify in Stripe Dashboard, check DB

**Est. Time:** 2-3 hours

---

### [010-03-card-subscription-checkout.md](010-03-card-subscription-checkout.md)
**Focus:** Card monthly subscription end-to-end

**Scope:**
- Checkout session endpoint
- checkout.session.completed webhook handler
- Success/cancel pages
- Frontend button integration

**Prerequisites:** 010-01, 010-02 completed

**Testing:** Complete card payment with test card (4242...), verify subscription created

**Est. Time:** 4-5 hours

---

### [010-04-webhook-infrastructure.md](010-04-webhook-infrastructure.md)
**Focus:** Complete webhook event handling

**Scope:**
- Idempotency tracking table
- subscription.updated handler
- subscription.deleted handler
- invoice.payment_succeeded handler
- invoice.payment_failed handler

**Prerequisites:** 010-01, 010-02, 010-03 completed

**Testing:** Trigger events with Stripe CLI, verify DB updates

**Est. Time:** 3-4 hours

---

### [010-05-sms-gating.md](010-05-sms-gating.md)
**Focus:** SMS notification restriction to paid users

**Scope:**
- Subscription status queries
- Modify getUsersNeedingNotification()
- Batch subscription check

**Prerequisites:** 010-01 through 010-04 completed

**Testing:** Trigger cron, verify only paid users receive SMS

**Est. Time:** 2-3 hours

---

### [010-06-blik-payment-flow.md](010-06-blik-payment-flow.md)
**Focus:** BLIK annual payment implementation

**Scope:**
- Payment Intent endpoint
- payment_intent.succeeded webhook handler
- BLIK payment page (Payment Element)
- Frontend BLIK button

**Prerequisites:** 010-01, 010-02, 010-04 completed

**Testing:** Complete BLIK payment with test code (000000), verify 1-year subscription

**Est. Time:** 4-5 hours

---

### [010-07-frontend-subscription-status.md](010-07-frontend-subscription-status.md)
**Focus:** UI for subscription status display

**Scope:**
- Subscription status API endpoint
- Dashboard badges (Premium Active / Free Plan)
- Pricing page (3 plans)
- Navigation integration

**Prerequisites:** 010-01 through 010-06 completed

**Testing:** View dashboard as free/premium user, verify badges and CTAs

**Est. Time:** 3-4 hours

---

### [010-08-security-hardening.md](010-08-security-hardening.md)
**Focus:** Security improvements and edge case handling

**Scope:**
- Duplicate payment prevention
- Webhook idempotency enforcement
- User ID validation
- Amount validation
- Error handling improvements

**Prerequisites:** All previous parts completed

**Testing:** Attack scenarios, duplicate event handling, validation bypasses

**Est. Time:** 3-4 hours

---

## Implementation Order

**Mandatory Sequence:**

1. **010-01** (Database) → Foundation for everything
2. **010-02** (Stripe Setup) → Required for payments
3. **010-03** (Card Checkout) → First payment flow
4. **010-04** (Webhooks) → Complete event handling

**Parallel Tracks After 010-04:**

Track A: SMS Feature
- **010-05** (SMS Gating) → Core business logic

Track B: BLIK Feature
- **010-06** (BLIK Payment) → Alternative payment method

Track C: Frontend
- **010-07** (Subscription Status) → User-facing UI

**Final:**
- **010-08** (Security) → Production hardening

---

## Estimated Timeline

**Sequential Implementation:**
- Total: 23-28 hours
- With testing/debugging: 30-35 hours
- Calendar time: 4-5 days (1 developer)

**Parallel Implementation (2 developers):**
- Dev 1: 010-01 → 010-02 → 010-03 → 010-04 → 010-08
- Dev 2: 010-05 + 010-06 + 010-07 (starts after 010-04)
- Total: 2-3 days

---

## Testing Checkpoints

Each part includes:
- **Testing Strategy** section with specific test cases
- **Acceptance Criteria** checklist
- **Expected outputs** for verification

Run full regression after each part:
```bash
# Part completed → Test
# Part 010-01 → Can query tables
# Part 010-02 → Customer created in Stripe
# Part 010-03 → Card payment creates subscription
# Part 010-04 → All webhooks process correctly
# Part 010-05 → SMS only to paid users
# Part 010-06 → BLIK payment creates 1-year subscription
# Part 010-07 → Dashboard shows correct status
# Part 010-08 → Security tests pass
```

---

## Rollback Strategy

Each part is reversible:

**010-01 (Database):**
```bash
# Rollback migration
pnpm drizzle:dev:drop
# Or manually: DROP TABLE subscriptions, payments, subscription_plans;
```

**010-02 (Stripe Setup):**
```typescript
// Comment out initStripe() call
// No DB changes to revert
```

**010-03 (Card Checkout):**
```bash
# Remove checkout route from app.ts
# Delete webhook handler
# Redeploy
```

**010-04 (Webhooks):**
```typescript
// Remove event handlers from switch statement
// Keep webhook_events table for audit trail
```

**010-05 (SMS Gating):**
```typescript
// Remove subscription filter from getUsersNeedingNotification()
// All users receive SMS again
```

**010-06 (BLIK):**
```bash
# Remove BLIK payment page route
# Remove payment intent endpoint
# Remove webhook handler
```

**010-07 (Frontend):**
```bash
# Remove subscription query from dashboard
# Hide pricing page link
```

**010-08 (Security):**
```typescript
// Security improvements can be rolled back individually
// Most are additive (validation, logging)
```

---

## Environment Progression

**Development → Stage → Production**

Each part tested in dev first, then stage, then prod:

```bash
# Dev
pnpm dev:data-service
stripe listen --forward-to localhost:8788/webhooks/stripe

# Stage
pnpm deploy:stage:data-service
pnpm deploy:stage:user-application
# Configure stage webhook in Stripe Dashboard

# Prod
pnpm deploy:prod:data-service
pnpm deploy:prod:user-application
# Configure prod webhook in Stripe Dashboard (LIVE mode)
```

---

## Success Metrics

After full implementation:

- [ ] Users can subscribe with card (monthly)
- [ ] Users can pay with BLIK (annual)
- [ ] Webhooks process all events without errors
- [ ] Only paid users receive SMS
- [ ] Dashboard shows correct subscription status
- [ ] Free users see upgrade CTA
- [ ] Security validations prevent abuse
- [ ] No duplicate subscriptions
- [ ] Payments logged correctly
- [ ] Stripe Dashboard matches database state

---

## Documentation Cross-Reference

**Main Document:** [010-payments.md](010-payments.md)
- Full specification (45 pages, 18,000 words)
- Complete technical details
- Business rules
- Architecture diagrams
- Full implementation checklist

**Split Documents:** (This directory)
- 010-01 through 010-08
- Focused, testable components
- Independent implementation
- Clear prerequisites
- Specific acceptance criteria

---

## Next Actions

1. Review all 8 documents
2. Confirm implementation order
3. Set up dev environment (Stripe test mode, local DB)
4. Start with 010-01 (database schema)
5. Test each part before moving to next
6. Deploy to stage after 010-04
7. Complete all parts in dev before prod deployment

---

## Questions to Resolve

From user:
- [ ] Confirm user ID source (session management)
- [ ] Confirm data service URL for frontend
- [ ] Confirm deployment strategy (stage first or direct to prod)
- [ ] Confirm Stripe account ownership (who sets up products)
- [ ] Confirm monitoring/alerting preferences

---

## References

- Main spec: [010-payments.md](010-payments.md)
- Project docs: [/docs/](../)
- Stripe docs: https://stripe.com/docs
- Drizzle ORM: https://orm.drizzle.team
