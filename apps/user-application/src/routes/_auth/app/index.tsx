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
import { StatusCard } from "@/components/dashboard/status-card";
import { Phone, MapPin } from "lucide-react";
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
          {/* Status Card */}
          <StatusCard
            isPremium={isPremium}
            hasAddress={hasAddress}
            hasPhone={hasPhone}
            subscriptionExpiry={
              subscription && typeof subscription === "object" && "currentPeriodEnd" in subscription
                ? new Date((subscription as { currentPeriodEnd: string }).currentPeriodEnd)
                : undefined
            }
          />

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl text-balance">
              {t("dashboard.yourDashboard")}
            </h1>
            {!setupComplete && (
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                {t("dashboard.completeSetup")}
              </p>
            )}
          </div>

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
