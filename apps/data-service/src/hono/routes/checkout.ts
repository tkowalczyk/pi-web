import { Hono } from "hono";
import { getStripe } from "@/stripe/client";
import { getOrCreateStripeCustomer } from "@/stripe/customer";
import { getUserProfile } from "@repo/data-ops/queries/user";

const checkout = new Hono<{ Bindings: Env }>();

checkout.post("/create-session", async (c) => {
  const body = await c.req.json();
  const { userId, priceId, successUrl, cancelUrl } = body;

  if (!userId || !priceId || !successUrl || !cancelUrl) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const user = await getUserProfile(userId);

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
