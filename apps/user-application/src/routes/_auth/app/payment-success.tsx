import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_auth/app/payment-success")({
  component: PaymentSuccess,
});

function PaymentSuccess() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl">{t("payment.successTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">{t("payment.successMessage")}</p>
          <Button onClick={() => router.navigate({ to: "/app" })}>
            {t("payment.goToDashboard")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
