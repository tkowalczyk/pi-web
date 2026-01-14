import { getStripe } from "./client";
import { getUserStripeCustomerId, saveStripeCustomerId } from "@repo/data-ops/queries/stripe-customer";

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name: string
): Promise<string> {
  const existingCustomerId = await getUserStripeCustomerId(userId);

  if (existingCustomerId) {
    return existingCustomerId;
  }

  const stripe = getStripe();

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      userId,
    },
  });

  await saveStripeCustomerId(userId, customer.id);

  return customer.id;
}
