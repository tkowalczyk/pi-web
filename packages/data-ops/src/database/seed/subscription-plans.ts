import { initDatabase } from '../setup';
import { subscription_plans } from "../../drizzle/schema";

export async function seedSubscriptionPlans() {
  const db = initDatabase({
      host: process.env.DATABASE_HOST!,
      username: process.env.DATABASE_USERNAME!,
      password: process.env.DATABASE_PASSWORD!
    });

  await db.insert(subscription_plans).values([
    {
      name: "Card Monthly",
      stripeProductId: process.env.STRIPE_CARD_MONTHLY_PRODUCT_ID!,
      stripePriceId: process.env.STRIPE_CARD_MONTHLY_PRICE_ID!,
      currency: "PLN",
      amount: 1000,
      interval: "month",
      intervalCount: 1,
      paymentMethod: "card",
      description: "Monthly subscription with card - PLN 10/month",
    },
    {
      name: "BLIK Annual",
      stripeProductId: process.env.STRIPE_BLIK_ANNUAL_PRODUCT_ID!,
      stripePriceId: process.env.STRIPE_BLIK_ANNUAL_PRICE_ID!,
      currency: "PLN",
      amount: 10000,
      interval: "year",
      intervalCount: 1,
      paymentMethod: "blik",
      description: "Annual payment with BLIK - PLN 100/year (save 2 months)",
    },
  ]).onConflictDoNothing();

  console.log("✓ Subscription plans seeded");
}
