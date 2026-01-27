import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useTranslation } from "react-i18next";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export const Route = createFileRoute("/_auth/app/payment/blik")({
  component: BlikPaymentPage,
});

interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

function BlikPaymentPage() {
  const { user } = Route.useRouteContext();
  const { t } = useTranslation();
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (): Promise<PaymentIntentResponse> => {
      const response = await fetch(`${import.meta.env.VITE_DATA_SERVICE_URL}/api/checkout/create-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": user.id,
        },
        body: JSON.stringify({
          userId: user.id,
          priceId: import.meta.env.VITE_STRIPE_BLIK_ANNUAL_PRICE_ID,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to create payment intent");
      }
      return response.json();
    },
    onSuccess: ({ clientSecret }) => {
      setClientSecret(clientSecret);
    },
  });

  useEffect(() => {
    mutation.mutate();
  }, []);

  if (mutation.isPending || !clientSecret) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center">{t("payment.loading")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mutation.isError) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">{t("payment.blik.initError")}</p>
            <Button onClick={() => mutation.mutate()} className="mt-4 w-full">
              {t("payment.blik.retry")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{t("payment.blik.title")}</CardTitle>
          <CardDescription>
            {t("payment.blik.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <BlikPaymentForm />
          </Elements>
        </CardContent>
      </Card>
    </div>
  );
}

function BlikPaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + "/app/payment-success",
      },
    });

    if (submitError) {
      setError(submitError.message || t("payment.blik.failed"));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && (
        <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
          {error}
        </div>
      )}
      <Button
        type="submit"
        className="w-full mt-6"
        disabled={!stripe || loading}
      >
        {loading ? t("payment.blik.processing") : t("payment.blik.payButton")}
      </Button>
    </form>
  );
}
