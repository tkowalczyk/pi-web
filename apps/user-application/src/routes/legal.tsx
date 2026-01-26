import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LandingNav } from "@/components/navigation/landing-nav";
import { Footer } from "@/components/landing/footer";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/legal")({
  component: LegalPage,
});

function LegalPage() {
  const { t } = useTranslation();

  const legalLinks = [
    { key: "termsOfService", path: "/terms-of-service" },
    { key: "cookiePolicy", path: "/cookie-policy" },
  ];

  return (
    <div className="min-h-dvh flex flex-col">
      <LandingNav />
      <main className="flex-1 px-6 py-16 w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-balance">{t("footer.legal")}</h1>
          <p className="text-muted-foreground text-lg">{t("staticPages.legalDescription")}</p>
        </div>

        <div className="flex flex-col gap-4">
          {legalLinks.map((link) => (
            <Link key={link.key} to={link.path}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-lg">{t(`footer.${link.key}`)}</CardTitle>
                  <CardDescription>{t(`staticPages.${link.key}Description`)}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
