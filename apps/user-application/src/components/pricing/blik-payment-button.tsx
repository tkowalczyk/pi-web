import { Button } from "@/components/ui/button";
import { useRouter } from "@tanstack/react-router";
import { Calendar } from "lucide-react";

export function BlikPaymentButton() {
  const router = useRouter();

  return (
    <Button onClick={() => router.navigate({ to: "/app/payment/blik" })}>
      <Calendar className="mr-2 h-4 w-4" />
      Pay with BLIK - Annual
    </Button>
  );
}
