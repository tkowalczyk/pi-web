import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

export function PricingSection() {
  const { t } = useTranslation();

  return (
    <div className="mb-16">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-4 text-balance">{t("pricing.title")}</h2>
        <p className="text-lg text-muted-foreground">{t("pricing.subtitle")}</p>
      </div>

      <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
        {/* Free Plan */}
        <Card>
          <CardHeader>
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
            <Link to="/app" className="w-full">
              <Button className="w-full" variant="outline">
                {t("landing.getStarted")}
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* Card Monthly */}
        <Card className="border-primary">
          <CardHeader>
            <Badge className="w-fit mb-2">{t("pricing.card.badge")}</Badge>
            <CardTitle>{t("pricing.card.title")}</CardTitle>
            <CardDescription>{t("pricing.card.description")}</CardDescription>
            <div className="text-3xl font-bold mt-4 tabular-nums">
              10 PLN
              <span className="text-base font-normal text-muted-foreground">/m</span>
            </div>
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
          <CardFooter>
            <Link to="/app" className="w-full">
              <Button className="w-full">{t("landing.getStarted")}</Button>
            </Link>
          </CardFooter>
        </Card>

        {/* BLIK Annual */}
        <Card className="border-2 border-primary shadow-lg">
          <CardHeader>
            <Badge className="w-fit mb-2 bg-green-500">{t("pricing.blik.badge")}</Badge>
            <CardTitle>{t("pricing.blik.title")}</CardTitle>
            <CardDescription>{t("pricing.blik.description")}</CardDescription>
            <div className="text-3xl font-bold mt-4 tabular-nums">
              100 PLN
              <span className="text-base font-normal text-muted-foreground">/rok</span>
            </div>
            <p className="text-sm text-green-600 font-medium">{t("pricing.blik.savings")}</p>
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
            <Link to="/app" className="w-full">
              <Button className="w-full">{t("landing.getStarted")}</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
