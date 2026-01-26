import { getDb } from "@/database/setup";
import { subscriptions, subscription_plans } from "@/drizzle/schema";
import { eq, and, gte, inArray, desc } from "drizzle-orm";

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

export async function updateSubscriptionByStripeId(
  stripeSubscriptionId: string,
  data: {
    status: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: Date | null;
  }
) {
  const db = getDb();
  await db
    .update(subscriptions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

export async function getSubscriptionByStripeId(stripeSubscriptionId: string) {
  const db = getDb();
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return sub;
}

export async function cancelSubscription(stripeSubscriptionId: string) {
  const db = getDb();
  await db
    .update(subscriptions)
    .set({
      status: "canceled",
      canceledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

export async function getActiveSubscriptionByUserId(userId: string) {
  const db = getDb();
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!sub || sub.status === "canceled" || sub.status === "expired") {
    return null;
  }
  return sub;
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const db = getDb();
  const now = new Date();

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
        gte(subscriptions.currentPeriodEnd, now)
      )
    )
    .limit(1);

  return !!subscription;
}

export async function getActiveUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const db = getDb();
  const now = new Date();

  const activeSubscriptions = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.userId, userIds),
        eq(subscriptions.status, "active"),
        gte(subscriptions.currentPeriodEnd, now)
      )
    );

  return new Set(activeSubscriptions.map(s => s.userId));
}

export async function getMySubscription(userId: string) {
  const db = getDb();
  const now = new Date();

  const [subscription] = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      plan: {
        name: subscription_plans.name,
        amount: subscription_plans.amount,
        interval: subscription_plans.interval,
        paymentMethod: subscription_plans.paymentMethod,
      },
    })
    .from(subscriptions)
    .innerJoin(subscription_plans, eq(subscriptions.subscriptionPlanId, subscription_plans.id))
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
        gte(subscriptions.currentPeriodEnd, now)
      )
    )
    .orderBy(desc(subscriptions.currentPeriodEnd))
    .limit(1);

  return subscription;
}
