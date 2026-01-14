import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function initStripe(secretKey: string): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    });
  }
  return stripeClient;
}

export function getStripe(): Stripe {
  if (!stripeClient) {
    throw new Error('Stripe client not initialized');
  }
  return stripeClient;
}
