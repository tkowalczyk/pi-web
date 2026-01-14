import Stripe from "stripe";
import { getStripe } from "@/stripe/client";
import { getSubscriptionPlanByPriceId, createSubscription } from "@repo/data-ops/queries/subscription";

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error("No userId in checkout session metadata");
    return;
  }

  const stripe = getStripe();
  const subscriptionId = session.subscription as string;

  if (!subscriptionId) {
    console.error("No subscription ID in checkout session");
    return;
  }

  const subscription: Stripe.Subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const subscriptionItem = subscription.items.data[0];

  if (!subscriptionItem) {
    console.error("No subscription item found");
    return;
  }

  const priceId = subscriptionItem.price.id;
  const plan = await getSubscriptionPlanByPriceId(priceId);

  if (!plan) {
    console.error(`No plan found for price ID: ${priceId}`);
    return;
  }

  await createSubscription({
    userId,
    subscriptionPlanId: plan.id,
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    status: "active",
    currentPeriodStart: new Date(subscriptionItem.current_period_start * 1000),
    currentPeriodEnd: new Date(subscriptionItem.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
  });

  console.log(`Created subscription for user ${userId}`);
}
