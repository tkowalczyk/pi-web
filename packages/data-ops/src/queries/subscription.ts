import { getDb } from "@/database/setup";
import { subscriptions, subscription_plans } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSubscriptionPlanByPriceId(priceId: string) {
  const db = getDb();
  const [plan] = await db
    .select()
    .from(subscription_plans)
    .where(eq(subscription_plans.stripePriceId, priceId))
    .limit(1);
  return plan;
}

interface CreateSubscriptionData {
  userId: string;
  subscriptionPlanId: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
}

export async function createSubscription(data: CreateSubscriptionData) {
  const db = getDb();
  const [subscription] = await db.insert(subscriptions).values(data).returning();
  return subscription;
}
