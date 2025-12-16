import { getDb } from "@/database/setup";
import { auth_user } from "@/drizzle/auth-schema";
import { eq } from "drizzle-orm";

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
