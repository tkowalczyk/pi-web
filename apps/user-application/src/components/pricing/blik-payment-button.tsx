import { Button } from "@/components/ui/button";
import { useRouter } from "@tanstack/react-router";
import { Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";

export function BlikPaymentButton() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Button onClick={() => router.navigate({ to: "/app/payment/blik" })}>
      <Calendar className="mr-2 h-4 w-4" />
      {t("pricing.blik.cta")}
    </Button>
  );
}
