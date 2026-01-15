import Stripe from "stripe";
import { cancelSubscription } from "@repo/data-ops/queries/subscription";

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await cancelSubscription(subscription.id);
  console.log(`Deleted subscription ${subscription.id}`);
}
