import Stripe from "stripe";
import { getSubscriptionByStripeId } from "@repo/data-ops/queries/subscription";
import { createPayment } from "@repo/data-ops/queries/payment";

export async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const invoiceAny = invoice as unknown as Record<string, unknown>;

  const subscriptionId = typeof invoiceAny.subscription === "string"
    ? invoiceAny.subscription
    : typeof invoiceAny.subscription === "object" && invoiceAny.subscription !== null
    ? (invoiceAny.subscription as { id: string }).id
    : null;

  if (!subscriptionId) {
    console.log("Invoice without subscription ID (likely one-time payment), skipping");
    return;
  }

  const subscription = await getSubscriptionByStripeId(subscriptionId);

  if (!subscription) {
    console.error(`No subscription found for ID: ${subscriptionId}`);
    return;
  }

  const paymentIntentId = typeof invoiceAny.payment_intent === "string"
    ? invoiceAny.payment_intent
    : typeof invoiceAny.payment_intent === "object" && invoiceAny.payment_intent !== null
    ? (invoiceAny.payment_intent as { id: string }).id
    : null;

  const chargeId = typeof invoiceAny.charge === "string"
    ? invoiceAny.charge
    : typeof invoiceAny.charge === "object" && invoiceAny.charge !== null
    ? (invoiceAny.charge as { id: string }).id
    : null;

  if (!paymentIntentId) {
    console.error("No payment intent ID in invoice");
    return;
  }

  await createPayment({
    userId: subscription.userId,
    subscriptionId: subscription.id,
    stripePaymentIntentId: paymentIntentId,
    stripeChargeId: chargeId,
    amount: invoice.amount_paid,
    currency: invoice.currency.toUpperCase(),
    status: "succeeded",
    paymentMethod: "card",
    receiptUrl: invoice.hosted_invoice_url,
    paidAt: new Date(),
  });

  console.log(`Logged recurring payment for subscription ${subscriptionId}`);
}
