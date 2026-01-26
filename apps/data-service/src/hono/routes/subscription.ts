import { Hono } from "hono";
import { getMySubscription, updateSubscriptionByStripeId } from "@repo/data-ops/queries/subscription";
import { getStripe } from "@/stripe/client";

const subscription = new Hono<{ Bindings: Env }>();

subscription.get("/my-subscription", async (c) => {
  const userId = c.req.header("X-User-Id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const subscription = await getMySubscription(userId);

  return c.json(subscription || null);
});

subscription.post("/cancel", async (c) => {
  const userId = c.req.header("X-User-Id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const sub = await getMySubscription(userId);

  if (!sub || !sub.stripeSubscriptionId) {
    return c.json({ error: "No active subscription" }, 400);
  }

  if (sub.plan.paymentMethod !== "card") {
    return c.json({ error: "Only card subscriptions can be canceled" }, 400);
  }

  const stripe = getStripe();
  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await updateSubscriptionByStripeId(sub.stripeSubscriptionId, {
    cancelAtPeriodEnd: true,
    status: sub.status,
  });

  return c.json({ success: true });
});

export default subscription;
