import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Eye, CheckCircle2, AlertTriangle, Smartphone, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface StatusCardProps {
  isPremium: boolean;
  hasAddress: boolean;
  hasPhone: boolean;
  subscriptionExpiry?: Date;
}

export function StatusCard({ isPremium, hasAddress, hasPhone, subscriptionExpiry }: StatusCardProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as "pl" | "en";

  const setupComplete = isPremium && hasAddress && hasPhone;

  // Non-premium user
  if (!isPremium) {
    return (
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
              <Eye className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{t("dashboard.status.freePlan.title")}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t("dashboard.status.freePlan.description")}</p>
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Smartphone className="h-4 w-4" />
                {t("dashboard.status.freePlan.noSms")}
              </div>
              <a href="/app/pricing">
                <Button className="mt-4" size="sm">
                  {t("dashboard.status.freePlan.upgradeCta")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Premium user with incomplete setup
  if (!setupComplete) {
    const missingSteps = [];
    if (!hasPhone) missingSteps.push(t("dashboard.phoneNumber"));
    if (!hasAddress) missingSteps.push(t("dashboard.addressLabel"));

    return (
      <Card className="mb-8 border-yellow-500/20 bg-yellow-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500/10">
              <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-500">
                {t("dashboard.status.premiumIncomplete.title")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">{t("dashboard.status.premiumIncomplete.description")}</p>
              <div className="mt-3 space-y-1">
                {missingSteps.map((step) => (
                  <div key={step} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Premium user with complete setup
  return (
    <Card className="mb-8 border-green-500/20 bg-green-500/5">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500/10">
            <Crown className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-green-700 dark:text-green-500">
              {t("dashboard.status.premiumActive.title")}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-600 dark:text-green-400">{t("dashboard.status.premiumActive.smsEnabled")}</span>
            </div>
            <div className="mt-3 border-t border-border/50 pt-3">
              <p className="text-sm text-muted-foreground">
                {t("dashboard.status.premiumActive.validUntil")}:{" "}
                <span className="font-medium text-foreground">
                  {subscriptionExpiry?.toLocaleDateString(locale === "pl" ? "pl-PL" : "en-US")}
                </span>
              </p>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Smartphone className="h-4 w-4" />
                {t("dashboard.smsNotificationTimes")}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
