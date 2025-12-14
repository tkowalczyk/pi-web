import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/core/functions/profile";
import { getMyAddresses } from "@/core/functions/addresses";
import { DashboardNav } from "@/components/navigation/dashboard-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhoneForm } from "@/components/profile/phone-form";
import { AddressList } from "@/components/addresses/address-list";
import { AddressForm } from "@/components/addresses/address-form";
import { Phone, MapPin, Bell, CheckCircle2, AlertCircle } from "lucide-react";

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
    ]);
  },
});

function Dashboard() {
  const { data: profile } = useSuspenseQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
  });

  const { data: addresses = [] } = useSuspenseQuery({
    queryKey: ["addresses"],
    queryFn: () => getMyAddresses(),
  });

  const hasAddress = addresses.length > 0;
  const hasPhone = !!profile?.phone;
  const setupComplete = hasAddress && hasPhone;

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      {/* Hero Section */}
      <section className="relative px-6 lg:px-8 pt-32 pb-16">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <div className="mb-4 flex justify-center gap-2">
              <Badge variant={setupComplete ? "default" : "secondary"} className="mb-2">
                {setupComplete ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Setup Complete
                  </>
                ) : (
                  <>
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Setup Required
                  </>
                )}
              </Badge>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Your <span className="text-primary">Dashboard</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              {setupComplete
                ? "Manage your profile and notification preferences"
                : "Complete your setup to start receiving waste collection notifications"}
            </p>
          </div>

          {/* Setup Status Cards */}
          {!setupComplete && (
            <Card className="mb-12 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  Complete Your Setup
                </CardTitle>
                <CardDescription>
                  To receive waste collection notifications, complete the following steps:
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
                      <p className="font-medium text-sm">Phone number</p>
                      <p className="text-xs text-muted-foreground">Required for SMS notifications</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                    {hasAddress ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-sm">Address</p>
                      <p className="text-xs text-muted-foreground">To match waste collection schedule</p>
                    </div>
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
                  <Badge variant="outline">Profile</Badge>
                </div>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>
                  Manage your phone number for SMS notifications
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
                  <Badge variant="outline">Addresses</Badge>
                </div>
                <CardTitle>Your Addresses</CardTitle>
                <CardDescription>
                  Manage locations for waste collection notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AddressList addresses={addresses} />
                {addresses.length === 0 && <AddressForm />}
              </CardContent>
            </Card>
          </div>

          {/* Notification Info Card */}
          {setupComplete && (
            <Card className="mt-8 border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-green-500" />
                  <CardTitle>Notifications Active</CardTitle>
                </div>
                <CardDescription>
                  You'll receive SMS notifications at 19:00 (day before) and 7:00 (collection day)
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* Background gradient */}
        <div className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl">
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary to-secondary opacity-10 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            }}
          />
        </div>
      </section>
    </div>
  );
}
