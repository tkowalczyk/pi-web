import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Bell, ArrowRight } from "lucide-react";
import { authClient } from "@/components/auth/client";
import { LandingNav } from "@/components/navigation/landing-nav";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const isLoggedIn = !!session?.user;

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <section className="relative px-6 lg:px-8 pt-32 pb-24">
        <div className="mx-auto max-w-5xl">
          {/* Hero */}
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              {t("landing.badge")}
            </Badge>
            <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl mb-6">
              {t("landing.neverMiss")} <span className="text-primary">{t("landing.collectionDay")}</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              {t("landing.getNotifications")}
            </p>
            <Link to="/app">
              <Button size="lg" className="text-lg px-8 py-6 group">
                {isLoggedIn ? t("landing.goToDashboard") : t("landing.getStarted")}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          {/* How it works */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="text-2xl">{t("landing.howItWorks")}</CardTitle>
              <CardDescription>{t("landing.simpleSetup")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold mb-1">1. {t("landing.addAddress")}</p>
                    <p className="text-sm text-muted-foreground">{t("landing.addAddressDescription")}</p>
                  </div>
                </div>

                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Phone className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold mb-1">2. {t("landing.addPhone")}</p>
                    <p className="text-sm text-muted-foreground">{t("landing.addPhoneDescription")}</p>
                  </div>
                </div>

                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Bell className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold mb-1">3. {t("landing.notifications")}</p>
                    <p className="text-sm text-muted-foreground">{t("landing.notificationsDescription")}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-12 mb-8">
            {t("landing.freeNotifications")}
          </p>

          {/* Coverage Stats */}
          <div className="mb-16">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-foreground mb-2">{t("landing.coverage")}</h2>
              <p className="text-muted-foreground">{t("landing.coverageDescription")}</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 max-w-2xl mx-auto">
              <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-transparent">
                <CardContent className="pt-6 text-center">
                  <div className="text-5xl font-bold text-primary mb-2">12</div>
                  <div className="text-lg text-muted-foreground">{t("landing.cities")}</div>
                </CardContent>
              </Card>
              <Card className="border-primary/20 bg-gradient-to-br from-secondary/10 to-transparent">
                <CardContent className="pt-6 text-center">
                  <div className="text-5xl font-bold text-primary mb-2">1,200+</div>
                  <div className="text-lg text-muted-foreground">{t("landing.streets")}</div>
                </CardContent>
              </Card>
            </div>
          </div>
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
