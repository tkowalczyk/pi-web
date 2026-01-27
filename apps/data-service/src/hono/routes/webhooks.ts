import { Hono } from "hono";
import { getStripe } from "@/stripe/client";
import Stripe from "stripe";
import { handleCheckoutSessionCompleted } from "@/stripe/webhooks/checkout-session-completed";
import { handleSubscriptionUpdated } from "@/stripe/webhooks/subscription-updated";
import { handleSubscriptionDeleted } from "@/stripe/webhooks/subscription-deleted";
import { handleInvoicePaymentSucceeded } from "@/stripe/webhooks/invoice-payment-succeeded";
import { handleInvoicePaymentFailed } from "@/stripe/webhooks/invoice-payment-failed";
import { handlePaymentIntentSucceeded } from "@/stripe/webhooks/payment-intent-succeeded";
import { isEventProcessed, markEventProcessed } from "@repo/data-ops/queries/webhook-events";
import { logWebhookError } from "@/stripe/webhooks/utils";

const webhooks = new Hono<{ Bindings: Env }>();

webhooks.post("/stripe", async (c) => {
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json({ error: "No signature" }, 400);
  }

  const body = await c.req.text();
  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[SECURITY] Webhook signature verification failed:", {
      error: err instanceof Error ? err.message : String(err),
      signature: signature.substring(0, 20) + "...",
      ip: c.req.header("cf-connecting-ip"),
    });
    return c.json({ error: "Invalid signature" }, 400);
  }

  console.log(`Webhook received: ${event.type} (${event.id})`);

  // Check idempotency
  if (await isEventProcessed(event.id)) {
    console.log(`[IDEMPOTENCY] Event ${event.id} already processed, skipping`);
    return c.json({ received: true, skipped: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        try {
          await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        } catch (err) {
          logWebhookError("checkout.session.completed", event.id, err, {
            sessionId: (event.data.object as Stripe.Checkout.Session).id,
            userId: (event.data.object as Stripe.Checkout.Session).metadata?.userId,
          });
          throw err;
        }
        break;

      case "customer.subscription.updated":
        try {
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        } catch (err) {
          logWebhookError("customer.subscription.updated", event.id, err, {
            subscriptionId: (event.data.object as Stripe.Subscription).id,
          });
          throw err;
        }
        break;

      case "customer.subscription.deleted":
        try {
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        } catch (err) {
          logWebhookError("customer.subscription.deleted", event.id, err, {
            subscriptionId: (event.data.object as Stripe.Subscription).id,
          });
          throw err;
        }
        break;

      case "invoice.payment_succeeded":
        try {
          await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        } catch (err) {
          logWebhookError("invoice.payment_succeeded", event.id, err, {
            invoiceId: (event.data.object as Stripe.Invoice).id,
          });
          throw err;
        }
        break;

      case "invoice.payment_failed":
        try {
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        } catch (err) {
          logWebhookError("invoice.payment_failed", event.id, err, {
            invoiceId: (event.data.object as Stripe.Invoice).id,
          });
          throw err;
        }
        break;

      case "payment_intent.succeeded":
        try {
          await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        } catch (err) {
          logWebhookError("payment_intent.succeeded", event.id, err, {
            paymentIntentId: (event.data.object as Stripe.PaymentIntent).id,
            userId: (event.data.object as Stripe.PaymentIntent).metadata?.userId,
          });
          throw err;
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark as processed
    await markEventProcessed(event.id, event.type);
  } catch (err) {
    console.error(`Error handling webhook ${event.type}:`, err);
    return c.json({ error: "Webhook handler failed" }, 500);
  }

  return c.json({ received: true });
});

export default webhooks;
