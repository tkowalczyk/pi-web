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
