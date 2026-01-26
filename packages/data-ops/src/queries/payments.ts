import { getDb } from "@/database/setup";
import { subscription_plans, subscriptions, payments } from "@/drizzle/schema";
import { auth_user } from "@/drizzle/auth-schema";
import { eq } from "drizzle-orm";

export async function getUserById(userId: string) {
  const db = getDb();
  const [user] = await db
    .select()
    .from(auth_user)
    .where(eq(auth_user.id, userId))
    .limit(1);
  return user;
}

export async function getPlanByPriceId(priceId: string) {
  const db = getDb();
  const [plan] = await db
    .select()
    .from(subscription_plans)
    .where(eq(subscription_plans.stripePriceId, priceId))
    .limit(1);
  return plan;
}

export async function getPlanById(planId: number) {
  const db = getDb();
  const [plan] = await db
    .select()
    .from(subscription_plans)
    .where(eq(subscription_plans.id, planId))
    .limit(1);
  return plan;
}

interface CreateBlikSubscriptionParams {
  userId: string;
  subscriptionPlanId: number;
  stripeCustomerId: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  stripeChargeId?: string;
  receiptUrl?: string;
}

export async function createBlikSubscription({
  userId,
  subscriptionPlanId,
  stripeCustomerId,
  stripePaymentIntentId,
  amount,
  currency,
  stripeChargeId,
  receiptUrl,
}: CreateBlikSubscriptionParams) {
  const db = getDb();

  const currentPeriodStart = new Date();
  const currentPeriodEnd = new Date();
  currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);

  const [subscription] = await db.insert(subscriptions).values({
    userId,
    subscriptionPlanId,
    stripeCustomerId,
    stripePaymentIntentId,
    status: "active",
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: false,
  }).returning();

  if (!subscription) {
    throw new Error("Failed to create subscription");
  }

  await db.insert(payments).values({
    userId,
    subscriptionId: subscription.id,
    stripePaymentIntentId,
    stripeChargeId,
    amount,
    currency,
    status: "succeeded",
    paymentMethod: "blik",
    receiptUrl,
    paidAt: new Date(),
  });

  return subscription;
}
