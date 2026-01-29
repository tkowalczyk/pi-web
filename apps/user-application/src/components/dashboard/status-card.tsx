import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, CheckCircle2, Circle, Smartphone, ArrowRight, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";

interface StatusCardProps {
  isPremium: boolean;
  hasAddress: boolean;
  hasPhone: boolean;
  subscriptionExpiry?: Date;
}

type Phase = "phone" | "address" | "payment" | "complete";

function getPhase(hasPhone: boolean, hasAddress: boolean, isPremium: boolean): Phase {
  if (!hasPhone) return "phone";
  if (!hasAddress) return "address";
  if (!isPremium) return "payment";
  return "complete";
}

export function StatusCard({ isPremium, hasAddress, hasPhone, subscriptionExpiry }: StatusCardProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as "pl" | "en";

  const phase = getPhase(hasPhone, hasAddress, isPremium);
  const completedSteps = [hasPhone, hasAddress, isPremium].filter(Boolean).length;

  const steps = [
    { key: "phone", done: hasPhone, label: t("dashboard.status.steps.phone") },
    { key: "address", done: hasAddress, label: t("dashboard.status.steps.address") },
    { key: "payment", done: isPremium, label: t("dashboard.status.steps.payment") },
  ];

  // Fully complete
  if (phase === "complete") {
    return (
      <Card className="mb-8 border-green-500/20 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500/10">
              <Crown className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-700 dark:text-green-500">
                {t("dashboard.status.complete.title")}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-600 dark:text-green-400">
                  {t("dashboard.status.complete.smsEnabled")}
                </span>
              </div>
              <div className="mt-3 border-t border-border/50 pt-3">
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.status.complete.validUntil")}:{" "}
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

  // In progress - show steps
  return (
    <Card className="mb-8">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            {phase === "payment" ? (
              <Calendar className="h-6 w-6 text-primary" />
            ) : (
              <Smartphone className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {t(`dashboard.status.${phase}.title`)}
              </h3>
              <span className="text-sm text-muted-foreground">
                {completedSteps}/3
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {t(`dashboard.status.${phase}.description`)}
            </p>

            {/* Progress steps */}
            <div className="mt-4 space-y-2">
              {steps.map((step) => (
                <div key={step.key} className="flex items-center gap-2 text-sm">
                  {step.done ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={step.done ? "text-muted-foreground line-through" : ""}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Show schedule hint when address is complete */}
            {phase === "payment" && (
              <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400">
                  <Calendar className="h-4 w-4" />
                  {t("dashboard.status.payment.scheduleVisible")}
                </div>
              </div>
            )}

            {phase === "payment" && (
              <a href="/app/pricing">
                <Button className="mt-4" size="sm">
                  {t("dashboard.status.payment.upgradeCta")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
