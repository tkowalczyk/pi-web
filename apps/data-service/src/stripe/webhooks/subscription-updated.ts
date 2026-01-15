import Stripe from "stripe";
import { updateSubscriptionByStripeId } from "@repo/data-ops/queries/subscription";

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const status = subscription.status === "active" || subscription.status === "trialing"
    ? "active"
    : subscription.status === "past_due"
    ? "past_due"
    : subscription.status === "canceled" || subscription.status === "incomplete_expired"
    ? "canceled"
    : "expired";

  const subscriptionItem = subscription.items.data[0];

  if (!subscriptionItem) {
    console.error("No subscription item found");
    return;
  }

  await updateSubscriptionByStripeId(subscription.id, {
    status,
    currentPeriodStart: new Date(subscriptionItem.current_period_start * 1000),
    currentPeriodEnd: new Date(subscriptionItem.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
  });

  console.log(`Updated subscription ${subscription.id} to status ${status}`);
}
