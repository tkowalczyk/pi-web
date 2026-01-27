import { Hono } from "hono";
import { getStripe } from "@/stripe/client";
import { getOrCreateStripeCustomer } from "@/stripe/customer";
import { getUserProfile } from "@repo/data-ops/queries/user";
import { getActiveSubscriptionByUserId } from "@repo/data-ops/queries/subscription";
import { getUserById, getPlanByPriceId } from "@repo/data-ops/queries/payments";

const checkout = new Hono<{ Bindings: Env }>();

checkout.post("/create-session", async (c) => {
  const body = await c.req.json();
  const { userId, priceId, successUrl, cancelUrl } = body;

  if (!userId || !priceId || !successUrl || !cancelUrl) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const sessionUserId = c.req.header("X-User-Id");
  if (sessionUserId && userId !== sessionUserId) {
    console.error("[SECURITY] User ID mismatch:", {
      provided: userId,
      session: sessionUserId,
      ip: c.req.header("cf-connecting-ip"),
    });
    return c.json({ error: "Unauthorized" }, 403);
  }

  const user = await getUserProfile(userId);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const existingSub = await getActiveSubscriptionByUserId(userId);
  if (existingSub) {
    return c.json(
      {
        error: "User already has active subscription",
        subscriptionId: existingSub.id,
        expiresAt: existingSub.currentPeriodEnd,
      },
      400
    );
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

checkout.post("/create-payment-intent", async (c) => {
  const body = await c.req.json();
  const { userId, priceId } = body;

  if (!userId || !priceId) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const sessionUserId = c.req.header("X-User-Id");
  if (sessionUserId && userId !== sessionUserId) {
    console.error("[SECURITY] User ID mismatch:", {
      provided: userId,
      session: sessionUserId,
      ip: c.req.header("cf-connecting-ip"),
    });
    return c.json({ error: "Unauthorized" }, 403);
  }

  const user = await getUserById(userId);
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const existingSub = await getActiveSubscriptionByUserId(userId);
  if (existingSub) {
    return c.json(
      {
        error: "User already has active subscription",
        subscriptionId: existingSub.id,
        expiresAt: existingSub.currentPeriodEnd,
      },
      400
    );
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
  });

  return c.json({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  });
});

export default checkout;
