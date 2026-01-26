import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/core/functions/profile";
import { getMyAddresses } from "@/core/functions/addresses";
import { getMyWasteSchedule } from "@/core/functions/waste";
import { getMySubscription } from "@/core/functions/subscription";
import { DashboardNav } from "@/components/navigation/dashboard-nav";
import { Footer } from "@/components/landing/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhoneForm } from "@/components/profile/phone-form";
import { AddressList } from "@/components/addresses/address-list";
import { AddressForm } from "@/components/addresses/address-form";
import { WasteScheduleCard } from "@/components/dashboard/waste-schedule-card";
import { Phone, MapPin, Bell, CheckCircle2, AlertCircle, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_auth/app/")({
  component: Dashboard,
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["profile"],
        queryFn: () => getMyProfile(),
      }),
      queryClient.prefetchQuery({
        queryKey: ["addresses"],
        queryFn: () => getMyAddresses(),
      }),
      queryClient.prefetchQuery({
        queryKey: ["waste-schedule"],
        queryFn: () => getMyWasteSchedule(),
      }),
      queryClient.prefetchQuery({
        queryKey: ["subscription"],
        queryFn: () => getMySubscription(),
      }),
    ]);
  },
});

function Dashboard() {
  const { t } = useTranslation();
  const { data: profile } = useSuspenseQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
  });

  const { data: addresses = [] } = useSuspenseQuery({
    queryKey: ["addresses"],
    queryFn: () => getMyAddresses(),
  });

  const { data: subscription } = useSuspenseQuery({
    queryKey: ["subscription"],
    queryFn: () => getMySubscription(),
  });

  const hasAddress = addresses.length > 0;
  const hasPhone = !!profile?.phone;
  const isPremium = !!subscription;
  const setupComplete = hasAddress && hasPhone && isPremium;

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <DashboardNav />

      {/* Hero Section */}
      <section className="flex-1 relative px-6 lg:px-8 pt-32 pb-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <div className="mb-4 flex justify-center gap-2">
              {isPremium ? (
                <>
                  <Badge className="bg-yellow-500 text-white">
                    <Crown className="mr-1 h-3 w-3" />
                    {t("dashboard.premiumActive")}
                  </Badge>
                  <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">
                    <Bell className="mr-1 h-3 w-3" />
                    {t("dashboard.smsEnabled")}
                  </Badge>
                </>
              ) : (
                <Badge variant="secondary">{t("dashboard.freePlan")}</Badge>
              )}
            </div>

            {isPremium && subscription && typeof subscription === "object" && "currentPeriodEnd" in subscription && (
              <p className="text-xs text-muted-foreground mb-4">
                {t("dashboard.subscriptionValid")}: {new Date((subscription as { currentPeriodEnd: string }).currentPeriodEnd).toLocaleDateString(t("language.code") === "pl" ? "pl-PL" : "en-US")}
              </p>
            )}

            <div className="mb-2 flex justify-center gap-2">
              <Badge variant={setupComplete ? "default" : "secondary"}>
                {setupComplete ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {t("dashboard.setupComplete")}
                  </>
                ) : (
                  <>
                    <AlertCircle className="mr-1 h-3 w-3" />
                    {t("dashboard.setupRequired")}
                  </>
                )}
              </Badge>
            </div>
            {setupComplete && (
              <p className="text-xs text-muted-foreground mb-4">
                {t("dashboard.smsNotificationTimes")}
              </p>
            )}

            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl text-balance">
              {t("dashboard.yourDashboard")}
            </h1>
            {!setupComplete && (
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                {t("dashboard.completeSetup")}
              </p>
            )}
          </div>

          {/* Setup Status Cards */}
          {!setupComplete && (
            <Card className="mb-12 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  {t("dashboard.completeYourSetup")}
                </CardTitle>
                <CardDescription>
                  {t("dashboard.completeSetupDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                    {hasPhone ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{t("dashboard.phoneNumber")}</p>
                      <p className="text-xs text-muted-foreground">{t("dashboard.phoneNumberDescription")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                    {hasAddress ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{t("dashboard.addressLabel")}</p>
                      <p className="text-xs text-muted-foreground">{t("dashboard.addressDescription")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                    {isPremium ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{t("dashboard.subscription")}</p>
                      <p className="text-xs text-muted-foreground">{t("dashboard.subscriptionDescription")}</p>
                    </div>
                    {!isPremium && (
                      <a href="/app/pricing" className="text-sm text-primary hover:underline">
                        {t("dashboard.upgradeCta")}
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Content Grid */}
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Profile Card */}
            <Card className="group hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <Badge variant="outline">{t("dashboard.profile")}</Badge>
                </div>
                <CardTitle>{t("dashboard.contactInformation")}</CardTitle>
                <CardDescription>
                  {t("dashboard.contactDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PhoneForm user={profile} />
              </CardContent>
            </Card>

            {/* Addresses Card */}
            <Card className="group hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <Badge variant="outline">{t("dashboard.addresses")}</Badge>
                </div>
                <CardTitle>{t("dashboard.yourAddresses")}</CardTitle>
                <CardDescription>
                  {t("dashboard.addressesDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AddressList addresses={addresses} />
                {addresses.length === 0 && <AddressForm />}
              </CardContent>
            </Card>
          </div>

          {/* Waste Collection Schedule */}
          {setupComplete && (
            <div className="mt-8">
              <WasteScheduleCard />
            </div>
          )}
        </div>

      </section>
      <Footer />
    </div>
  );
}
