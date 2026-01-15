import Stripe from "stripe";
import { getSubscriptionByStripeId, updateSubscriptionByStripeId } from "@repo/data-ops/queries/subscription";
import { createPayment } from "@repo/data-ops/queries/payment";

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const invoiceAny = invoice as unknown as Record<string, unknown>;

  const subscriptionId = typeof invoiceAny.subscription === "string"
    ? invoiceAny.subscription
    : typeof invoiceAny.subscription === "object" && invoiceAny.subscription !== null
    ? (invoiceAny.subscription as { id: string }).id
    : null;

  if (!subscriptionId) {
    console.log("Invoice without subscription ID, skipping");
    return;
  }

  const subscription = await getSubscriptionByStripeId(subscriptionId);

  if (!subscription) {
    console.error(`No subscription found for ID: ${subscriptionId}`);
    return;
  }

  await updateSubscriptionByStripeId(subscriptionId, {
    status: "past_due",
  });

  const paymentIntentId = typeof invoiceAny.payment_intent === "string"
    ? invoiceAny.payment_intent
    : typeof invoiceAny.payment_intent === "object" && invoiceAny.payment_intent !== null
    ? (invoiceAny.payment_intent as { id: string }).id
    : null;

  if (!paymentIntentId) {
    console.error("No payment intent ID in invoice");
    return;
  }

  await createPayment({
    userId: subscription.userId,
    subscriptionId: subscription.id,
    stripePaymentIntentId: paymentIntentId,
    amount: invoice.amount_due,
    currency: invoice.currency.toUpperCase(),
    status: "failed",
    paymentMethod: "card",
    failureCode: invoice.last_finalization_error?.code,
    failureMessage: invoice.last_finalization_error?.message,
    paidAt: null,
  });

  console.log(`Payment failed for subscription ${subscriptionId}`);
}
