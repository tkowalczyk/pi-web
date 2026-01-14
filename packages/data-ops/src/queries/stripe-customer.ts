import { getDb } from "@/database/setup";
import { auth_user } from "@/drizzle/auth-schema";
import { eq } from "drizzle-orm";

export async function getUserStripeCustomerId(userId: string): Promise<string | null> {
  const db = getDb();

  const [user] = await db
    .select({ stripeCustomerId: auth_user.stripeCustomerId })
    .from(auth_user)
    .where(eq(auth_user.id, userId))
    .limit(1);

  return user?.stripeCustomerId || null;
}

export async function saveStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
  const db = getDb();

  await db
    .update(auth_user)
    .set({ stripeCustomerId, updatedAt: new Date() })
    .where(eq(auth_user.id, userId));
}
