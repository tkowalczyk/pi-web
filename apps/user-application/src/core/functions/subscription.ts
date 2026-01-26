import { createServerFn } from "@tanstack/react-start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

interface SubscriptionPlan {
  name: string;
  amount: number;
  interval: string;
  paymentMethod: string;
}

interface Subscription {
  id: number;
  status: string;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan: SubscriptionPlan;
}

export const getMySubscription = baseFunction.handler(async (ctx): Promise<Subscription | null> => {
  const response = await fetch(`${process.env.VITE_DATA_SERVICE_URL}/api/subscription/my-subscription`, {
    headers: {
      "X-User-Id": ctx.context.userId,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized");
    }
    throw new Error("Failed to fetch subscription");
  }

  return response.json();
});

export const cancelSubscription = baseFunction.handler(async (ctx): Promise<{ success: boolean }> => {
  const response = await fetch(`${process.env.VITE_DATA_SERVICE_URL}/api/subscription/cancel`, {
    method: "POST",
    headers: {
      "X-User-Id": ctx.context.userId,
    },
  });

  if (!response.ok) {
    const error = (await response.json()) as { error?: string };
    throw new Error(error.error || "Failed to cancel subscription");
  }

  return response.json();
});
