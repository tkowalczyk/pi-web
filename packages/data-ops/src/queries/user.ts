import { getDb } from "@/database/setup";
import { auth_user, auth_account } from "@/drizzle/auth-schema";
import { eq, and } from "drizzle-orm";

export async function getUserProfile(userId: string) {
  const db = getDb();
  const [user] = await db
    .select({
      id: auth_user.id,
      name: auth_user.name,
      email: auth_user.email,
      phone: auth_user.phone,
    })
    .from(auth_user)
    .where(eq(auth_user.id, userId));
  return user;
}

export async function updateUserPhone(userId: string, phone: string | null) {
  const db = getDb();
  await db
    .update(auth_user)
    .set({ phone })
    .where(eq(auth_user.id, userId));
  return getUserProfile(userId);
}

export async function updateUserLanguage(userId: string, language: string) {
  const db = getDb();
  await db
    .update(auth_user)
    .set({ preferredLanguage: language })
    .where(eq(auth_user.id, userId));
  return { success: true };
}

export async function hasCredentialAccount(userId: string) {
  const db = getDb();
  const [account] = await db
    .select({ id: auth_account.id })
    .from(auth_account)
    .where(
      and(
        eq(auth_account.userId, userId),
        eq(auth_account.providerId, "credential")
      )
    )
    .limit(1);
  return !!account;
}
