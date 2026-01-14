import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

interface Props {
  userId: string;
  disabled?: boolean;
}

interface CheckoutResponse {
  sessionUrl: string;
}

export function CardSubscriptionButton({ userId, disabled }: Props) {
  const { t } = useTranslation();
  const mutation = useMutation({
    mutationFn: async (): Promise<CheckoutResponse> => {
      const response = await fetch(`${import.meta.env.VITE_DATA_SERVICE_URL}/api/checkout/create-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          priceId: import.meta.env.VITE_STRIPE_CARD_MONTHLY_PRICE_ID,
          successUrl: window.location.origin + "/app/payment-success",
          cancelUrl: window.location.origin + "/app/payment-cancel",
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }
      return response.json();
    },
    onSuccess: ({ sessionUrl }) => {
      window.location.href = sessionUrl;
    },
    onError: (err) => {
      console.error("Failed to create checkout session:", err);
      alert(t("payment.errorAlert"));
    },
  });

  return (
    <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || disabled}>
      {mutation.isPending ? t("payment.loading") : t("payment.subscribeButton")}
    </Button>
  );
}
