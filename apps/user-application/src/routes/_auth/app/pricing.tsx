import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown } from "lucide-react";
import { CardSubscriptionButton } from "@/components/pricing/card-subscription-button";
import { BlikPaymentButton } from "@/components/pricing/blik-payment-button";
import { DashboardNav } from "@/components/navigation/dashboard-nav";
import { Footer } from "@/components/landing/footer";
import { useTranslation } from "react-i18next";
import { getMySubscription, cancelSubscription } from "@/core/functions/subscription";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_auth/app/pricing")({
  component: PricingPage,
  loader: async ({ context: { queryClient } }) => {
    await queryClient.prefetchQuery({
      queryKey: ["subscription"],
      queryFn: () => getMySubscription(),
    });
  },
});

function PricingPage() {
  const { t } = useTranslation();
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const { data: subscription } = useSuspenseQuery({
    queryKey: ["subscription"],
    queryFn: () => getMySubscription(),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });

  const isPremium = !!subscription;
  const isCardMonthly = subscription?.plan?.paymentMethod === "card";
  const isBlikAnnual = subscription?.plan?.paymentMethod === "blik";
  const isCanceling = subscription?.cancelAtPeriodEnd;

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <DashboardNav />

      <section className="flex-1 relative px-6 lg:px-8 pt-32 pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 text-balance">{t("pricing.title")}</h1>
            <p className="text-lg text-muted-foreground">
              {t("pricing.subtitle")}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
            {/* Free Plan */}
            <Card className={!isPremium ? "ring-2 ring-primary" : ""}>
              <CardHeader>
                {!isPremium && (
                  <Badge className="w-fit mb-2 bg-yellow-500">
                    <Crown className="mr-1 h-3 w-3" />
                    {t("pricing.yourPlan")}
                  </Badge>
                )}
                <CardTitle>{t("pricing.free.title")}</CardTitle>
                <CardDescription>{t("pricing.free.description")}</CardDescription>
                <div className="text-3xl font-bold mt-4 tabular-nums">{t("pricing.free.price")}</div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{t("pricing.free.feature1")}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{t("pricing.free.feature2")}</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant="outline" disabled>
                  {!isPremium ? t("pricing.currentPlan") : t("pricing.free.title")}
                </Button>
              </CardFooter>
            </Card>

            {/* Card Monthly */}
            <Card className={isCardMonthly ? "ring-2 ring-primary" : "border-primary"}>
              <CardHeader>
                {isCardMonthly ? (
                  <Badge className="w-fit mb-2 bg-yellow-500">
                    <Crown className="mr-1 h-3 w-3" />
                    {t("pricing.yourPlan")}
                  </Badge>
                ) : (
                  <Badge className="w-fit mb-2">{t("pricing.card.badge")}</Badge>
                )}
                <CardTitle>{t("pricing.card.title")}</CardTitle>
                <CardDescription>{t("pricing.card.description")}</CardDescription>
                <div className="text-3xl font-bold mt-4 tabular-nums">
                  10 PLN
                  <span className="text-base font-normal text-muted-foreground">/m</span>
                </div>
                {isCardMonthly && isCanceling && subscription && (
                  <p className="text-sm text-orange-600 font-medium">
                    {t("pricing.willExpire")}: {new Date(subscription.currentPeriodEnd).toLocaleDateString(t("language.code") === "pl" ? "pl-PL" : "en-US")}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{t("pricing.card.feature1")}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{t("pricing.card.feature2")}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{t("pricing.card.feature3")}</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter className="flex-col gap-2">
                {isCardMonthly ? (
                  isCanceling ? (
                    <Button className="w-full" variant="outline" disabled>
                      {t("pricing.currentPlan")}
                    </Button>
                  ) : (
                    <>
                      <Button
                        className="w-full"
                        variant="destructive"
                        disabled={cancelMutation.isPending}
                        onClick={() => setCancelDialogOpen(true)}
                      >
                        {cancelMutation.isPending ? t("pricing.canceling") : t("pricing.cancelSubscription")}
                      </Button>
                      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t("pricing.cancelConfirm")}</DialogTitle>
                            <DialogDescription>{t("pricing.cancelWarning")}</DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                              {t("common.cancel")}
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => {
                                cancelMutation.mutate();
                                setCancelDialogOpen(false);
                              }}
                            >
                              {t("pricing.cancelSubscription")}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </>
                  )
                ) : isPremium ? (
                  <Button className="w-full" variant="outline" disabled>
                    {t("pricing.card.cta")}
                  </Button>
                ) : (
                  <CardSubscriptionButton userId={user.id} />
                )}
              </CardFooter>
            </Card>

            {/* BLIK Annual */}
            <Card className={isBlikAnnual ? "ring-2 ring-primary" : "border-2 border-primary shadow-lg"}>
              <CardHeader>
                {isBlikAnnual ? (
                  <Badge className="w-fit mb-2 bg-yellow-500">
                    <Crown className="mr-1 h-3 w-3" />
                    {t("pricing.yourPlan")}
                  </Badge>
                ) : (
                  <Badge className="w-fit mb-2 bg-green-500">{t("pricing.blik.badge")}</Badge>
                )}
                <CardTitle>{t("pricing.blik.title")}</CardTitle>
                <CardDescription>{t("pricing.blik.description")}</CardDescription>
                <div className="text-3xl font-bold mt-4 tabular-nums">
                  70 PLN
                  <span className="text-base font-normal text-muted-foreground">/rok</span>
                </div>
                {!isBlikAnnual && (
                  <p className="text-sm text-green-600 font-medium">
                    {t("pricing.blik.savings")}
                  </p>
                )}
                {isBlikAnnual && subscription && (
                  <p className="text-sm text-muted-foreground">
                    {t("pricing.willExpire")}: {new Date(subscription.currentPeriodEnd).toLocaleDateString(t("language.code") === "pl" ? "pl-PL" : "en-US")}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{t("pricing.blik.feature1")}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{t("pricing.blik.feature2")}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{t("pricing.blik.feature3")}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{t("pricing.blik.feature4")}</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                {isBlikAnnual ? (
                  <Button className="w-full" variant="outline" disabled>
                    {t("pricing.currentPlan")}
                  </Button>
                ) : isPremium ? (
                  <Button className="w-full" variant="outline" disabled>
                    {t("pricing.blik.cta")}
                  </Button>
                ) : (
                  <BlikPaymentButton />
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
