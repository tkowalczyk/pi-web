# Payment System - Frontend Subscription Status

**Parent Document:** [010-payments.md](010-payments.md)
**Version:** 1.0
**Status:** Ready for Implementation

---

## Overview

Display subscription status in dashboard, create pricing page, implement success/cancel pages. Visual feedback for free vs premium users.

---

## Prerequisites

**Required:**
- [010-01-database-schema.md](010-01-database-schema.md) completed
- [010-02-stripe-setup.md](010-02-stripe-setup.md) completed
- [010-03-card-subscription-checkout.md](010-03-card-subscription-checkout.md) completed (success/cancel pages)
- [010-06-blik-payment-flow.md](010-06-blik-payment-flow.md) completed
- Active subscriptions exist for testing

---

## Implementation

### 1. Backend - Subscription Status API

**File:** `packages/data-ops/src/queries/subscriptions.ts` (add)

```typescript
export async function getMySubscription(userId: string) {
  const db = getDb();
  const now = new Date();

  const [subscription] = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      plan: {
        name: subscription_plans.name,
        amount: subscription_plans.amount,
        interval: subscription_plans.interval,
        paymentMethod: subscription_plans.paymentMethod,
      },
    })
    .from(subscriptions)
    .innerJoin(subscription_plans, eq(subscriptions.subscriptionPlanId, subscription_plans.id))
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
        gte(subscriptions.currentPeriodEnd, now)
      )
    )
    .orderBy(desc(subscriptions.currentPeriodEnd))
    .limit(1);

  return subscription;
}
```

Rebuild:
```bash
pnpm build:data-ops
```

**File:** `apps/data-service/src/hono/routes/subscription.ts`

```typescript
import { Hono } from "hono";
import { getMySubscription } from "@repo/data-ops/queries/subscriptions";

const subscription = new Hono<{ Bindings: Env }>();

subscription.get("/my-subscription", async (c) => {
  const userId = c.get("userId"); // TODO: Get from session middleware

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const subscription = await getMySubscription(userId);

  return c.json(subscription || null);
});

export default subscription;
```

**File:** `apps/data-service/src/hono/app.ts`

```typescript
import subscription from "@/hono/routes/subscription";

app.route("/api/subscription", subscription);
```

### 2. Frontend - Subscription Query

**File:** `apps/user-application/src/core/functions/subscription.ts`

```typescript
export async function getMySubscription() {
  const response = await fetch("YOUR_DATA_SERVICE_URL/api/subscription/my-subscription", {
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized");
    }
    throw new Error("Failed to fetch subscription");
  }

  return response.json();
}
```

### 3. Dashboard - Subscription Status

**File:** `apps/user-application/src/routes/_auth/app/index.tsx`

```typescript
import { useSuspenseQuery } from "@tanstack/react-query";
import { getMySubscription } from "@/core/functions/subscription";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, Bell } from "lucide-react";
import { useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/app/")({
  component: Dashboard,
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      // ... existing prefetch
      queryClient.prefetchQuery({
        queryKey: ["subscription"],
        queryFn: () => getMySubscription(),
      }),
    ]);
  },
});

function Dashboard() {
  const router = useRouter();
  const { data: subscription } = useSuspenseQuery({
    queryKey: ["subscription"],
    queryFn: () => getMySubscription(),
  });

  const isPremium = !!subscription;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DashboardNav />

      <section className="flex-1 relative px-6 lg:px-8 pt-32 pb-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            {/* Subscription Status Badges */}
            <div className="mb-4 flex justify-center gap-2">
              {isPremium ? (
                <>
                  <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                    <Crown className="mr-1 h-3 w-3" />
                    Premium Active
                  </Badge>
                  <Badge variant="outline" className="border-green-500/40 text-green-600">
                    <Bell className="mr-1 h-3 w-3" />
                    SMS Enabled
                  </Badge>
                </>
              ) : (
                <Badge variant="secondary">
                  Free Plan - View Only
                </Badge>
              )}
            </div>

            {/* Premium Info */}
            {isPremium && (
              <p className="text-xs text-muted-foreground">
                Valid until: {new Date(subscription.currentPeriodEnd).toLocaleDateString("pl-PL")}
              </p>
            )}

            {/* Free User Upgrade CTA */}
            {!isPremium && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Upgrade to Premium to receive SMS notifications about waste collection.
                </p>
                <Button onClick={() => router.navigate({ to: "/app/pricing" })}>
                  Upgrade to Premium
                </Button>
              </div>
            )}

            {/* Rest of dashboard content */}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
```

### 4. Pricing Page

**File:** `apps/user-application/src/routes/_auth/app/pricing.tsx`

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Calendar } from "lucide-react";
import { CardSubscriptionButton } from "@/components/pricing/card-subscription-button";
import { BlikPaymentButton } from "@/components/pricing/blik-payment-button";

export const Route = createFileRoute("/_auth/app/pricing")({
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-lg text-muted-foreground">
          Get SMS reminders for waste collection schedules
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
        {/* Free Plan */}
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <CardDescription>View waste schedules</CardDescription>
            <div className="text-3xl font-bold mt-4">0 PLN</div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>View full waste schedule (2 weeks)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Add multiple addresses</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full" variant="outline" disabled>
              Current Plan
            </Button>
          </CardFooter>
        </Card>

        {/* Card Monthly */}
        <Card className="border-primary">
          <CardHeader>
            <Badge className="w-fit mb-2">Popular</Badge>
            <CardTitle>Card Monthly</CardTitle>
            <CardDescription>Automatic monthly payments</CardDescription>
            <div className="text-3xl font-bold mt-4">
              10 PLN
              <span className="text-base font-normal text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>SMS notifications</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>All addresses covered</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Cancel anytime</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <CardSubscriptionButton userId="USER_ID" />
          </CardFooter>
        </Card>

        {/* BLIK Annual */}
        <Card className="border-2 border-primary shadow-lg">
          <CardHeader>
            <Badge className="w-fit mb-2 bg-green-500">Best Value</Badge>
            <CardTitle>BLIK Annual</CardTitle>
            <CardDescription>One-time payment, save 2 months</CardDescription>
            <div className="text-3xl font-bold mt-4">
              100 PLN
              <span className="text-base font-normal text-muted-foreground">/year</span>
            </div>
            <p className="text-sm text-green-600 font-medium">
              Save 20 PLN vs monthly
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>SMS notifications</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>All addresses covered</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>No recurring charges</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>BLIK instant payment</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <BlikPaymentButton />
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
```

### 5. Navigation Link

**File:** `apps/user-application/src/components/dashboard-nav.tsx`

```typescript
// Add to navigation
<Link to="/app/pricing">Pricing</Link>
```

---

## Translations (i18n)

**File:** `apps/user-application/src/locales/pl.json`

```json
{
  "dashboard": {
    "premiumActive": "Premium Aktywne",
    "smsEnabled": "SMS Włączone",
    "freePlan": "Darmowy Plan - Tylko Podgląd",
    "upgradeMessage": "Przejdź na Premium, aby otrzymywać powiadomienia SMS.",
    "upgradeCta": "Przejdź na Premium",
    "subscriptionValid": "Ważna do"
  },
  "pricing": {
    "title": "Wybierz Plan",
    "subtitle": "Otrzymuj przypomnienia SMS o harmonogramach wywozu śmieci",
    "free": {
      "title": "Darmowy",
      "description": "Przeglądaj harmonogramy",
      "price": "0 PLN",
      "feature1": "Pełny harmonogram (2 tygodnie)",
      "feature2": "Wiele adresów"
    },
    "card": {
      "title": "Karta Miesięcznie",
      "badge": "Popularne",
      "description": "Automatyczne płatności miesięczne",
      "feature1": "Powiadomienia SMS",
      "feature2": "Wszystkie adresy",
      "feature3": "Anuluj w dowolnym momencie",
      "cta": "Subskrybuj - Karta"
    },
    "blik": {
      "title": "BLIK Rocznie",
      "badge": "Najlepsza Wartość",
      "description": "Jednorazowa płatność, oszczędź 2 miesiące",
      "savings": "Oszczędź",
      "feature1": "Powiadomienia SMS",
      "feature2": "Wszystkie adresy",
      "feature3": "Brak opłat cyklicznych",
      "feature4": "BLIK natychmiastowa płatność",
      "cta": "Zapłać BLIK"
    },
    "currentPlan": "Obecny Plan",
    "loading": "Ładowanie..."
  }
}
```

Add English translations to `en.json`.

---

## Testing Strategy

### 1. Visual Testing

**Free User:**
- Badge: "Free Plan - View Only"
- Upgrade CTA visible
- Pricing link in nav

**Premium User (Card Monthly):**
- Badge: "Premium Active" + "SMS Enabled"
- Valid until date shown
- No upgrade CTA

**Premium User (BLIK Annual):**
- Same badges as card monthly
- Valid until date = 1 year from payment

### 2. Navigation Testing

- Click "Upgrade to Premium" → Navigate to /app/pricing
- Click "Pricing" in nav → Pricing page loads
- Click "Subscribe - Card" → Redirect to Stripe Checkout
- Click "Pay with BLIK" → Navigate to /app/payment/blik

### 3. Subscription Query Testing

```bash
# Test API directly
curl http://localhost:8788/api/subscription/my-subscription \
  -H "Cookie: session=xxx"

# Expected (premium user):
{
  "id": 1,
  "status": "active",
  "currentPeriodStart": "2026-01-01T00:00:00.000Z",
  "currentPeriodEnd": "2026-02-01T00:00:00.000Z",
  "plan": {
    "name": "Card Monthly",
    "amount": 1000,
    "interval": "month",
    "paymentMethod": "card"
  }
}

# Expected (free user):
null
```

### 4. Edge Cases

| User State | Status Shown | CTA |
|------------|--------------|-----|
| No subscription | Free Plan | Upgrade button |
| Active card monthly | Premium Active | None |
| Active BLIK annual | Premium Active | None |
| Expired subscription | Free Plan | Upgrade button |
| Subscription expires today | Premium Active (until midnight) | None |
| Past due | Free Plan | Upgrade button |

---

## Acceptance Criteria

- [ ] Backend subscription status API works
- [ ] Frontend fetches subscription on dashboard load
- [ ] Free users see "Free Plan - View Only" badge
- [ ] Premium users see "Premium Active" + "SMS Enabled" badges
- [ ] Valid until date shown for premium users
- [ ] Upgrade CTA shown only to free users
- [ ] Pricing page displays all 3 plans
- [ ] Card Monthly button redirects to Stripe Checkout
- [ ] BLIK Annual button navigates to BLIK payment page
- [ ] Navigation includes pricing link
- [ ] Translations work (Polish + English)
- [ ] Success/cancel pages implemented (from 010-03)
- [ ] Mobile responsive design

---

## Design Consistency

**Badge Colors:**
- Premium: Gold gradient (`from-yellow-500 to-orange-500`)
- SMS Enabled: Green outline (`border-green-500/40 text-green-600`)
- Free: Secondary gray (`variant="secondary"`)

**Button Hierarchy:**
- Primary action: BLIK Annual (most prominent)
- Secondary: Card Monthly (outlined primary)
- Disabled: Free (outline gray)

**Icons:**
- Crown: Premium status
- Bell: SMS enabled
- Zap: Card monthly (fast recurring)
- Calendar: BLIK annual (yearly payment)

---

## Next Steps

After completion, proceed to:
- [010-08-security-hardening.md](010-08-security-hardening.md) - Idempotency, validation, duplicate prevention

---

## References

- Main doc: [010-payments.md](010-payments.md) Section 7
- Dashboard component: `apps/user-application/src/routes/_auth/app/index.tsx`
- TanStack Query docs: https://tanstack.com/query/latest
