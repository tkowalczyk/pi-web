import Stripe from "stripe";
import { getPlanById, createBlikSubscription, getUserById } from "@repo/data-ops/queries/payments";

export async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata?.userId;
  const subscriptionPlanId = paymentIntent.metadata?.subscriptionPlanId;

  if (!userId || !subscriptionPlanId) {
    console.error("[WEBHOOK ERROR] Missing metadata in payment intent", {
      paymentIntentId: paymentIntent.id,
      userId,
      subscriptionPlanId,
    });
    return;
  }

  const user = await getUserById(userId);
  if (!user) {
    console.error("[WEBHOOK ERROR] User not found in database", {
      userId,
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  const plan = await getPlanById(parseInt(subscriptionPlanId));
  if (!plan) {
    console.error(`No plan found for ID: ${subscriptionPlanId}`);
    return;
  }

  const latestCharge = paymentIntent.latest_charge;
  const chargeId = typeof latestCharge === "string" ? latestCharge : latestCharge?.id;

  await createBlikSubscription({
    userId,
    subscriptionPlanId: plan.id,
    stripeCustomerId: paymentIntent.customer as string,
    stripePaymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency.toUpperCase(),
    stripeChargeId: chargeId,
  });

  console.log(`Created BLIK annual subscription for user ${userId}`);
}
