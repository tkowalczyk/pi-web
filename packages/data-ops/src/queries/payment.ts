import { getDb } from "@/database/setup";
import { payments } from "@/drizzle/schema";

interface CreatePaymentData {
  userId: string;
  subscriptionId: number;
  stripePaymentIntentId: string;
  stripeChargeId?: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  receiptUrl?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  paidAt: Date | null;
}

export async function createPayment(data: CreatePaymentData) {
  const db = getDb();
  const [payment] = await db.insert(payments).values(data).returning();
  return payment;
}
