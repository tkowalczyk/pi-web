import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LandingNav } from "@/components/navigation/landing-nav";
import { Footer } from "@/components/landing/footer";

export const Route = createFileRoute("/cookie-policy")({
  component: CookiePolicyPage,
});

function CookiePolicyPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh flex flex-col">
      <LandingNav />
      <main className="flex-1 px-6 py-16 w-full">
        <h1 className="text-4xl font-bold mb-12 text-center text-balance">{t("footer.cookiePolicy")}</h1>
        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8">
          <div className="space-y-2">
            <p className="text-sm"><strong>{t("cookiePolicy.companyNameLabel")}</strong> {t("cookiePolicy.companyName")}</p>
            <p className="text-sm"><strong>{t("cookiePolicy.policyOwnerLabel")}</strong> {t("cookiePolicy.policyOwner")}</p>
            <p className="text-sm"><strong>{t("cookiePolicy.effectiveDateLabel")}</strong> {t("cookiePolicy.effectiveDate")}</p>
          </div>

          <section>
            <h2 className="text-primary border-b pb-2">{t("cookiePolicy.purposeTitle")}</h2>
            <p className="text-muted-foreground mt-4">{t("cookiePolicy.purposeContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("cookiePolicy.scopeTitle")}</h2>
            <p className="text-muted-foreground mt-4">{t("cookiePolicy.scopeContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("cookiePolicy.policyTitle")}</h2>

            <div className="ml-6 mt-6 space-y-4">
              <div>
                <h3 className="font-semibold">{t("cookiePolicy.howWeUse.title")}</h3>
                <p className="text-muted-foreground">{t("cookiePolicy.howWeUse.content")}</p>
              </div>

              <div>
                <h3 className="font-semibold">{t("cookiePolicy.detailedInfo.title")}</h3>
                <p className="text-muted-foreground">{t("cookiePolicy.detailedInfo.content")}</p>
              </div>

              <div>
                <h3 className="font-semibold">{t("cookiePolicy.strictlyNecessary.title")}</h3>
                <p className="text-muted-foreground">{t("cookiePolicy.strictlyNecessary.content")}</p>
              </div>

              <div>
                <h3 className="font-semibold">{t("cookiePolicy.analytics.title")}</h3>
                <p className="text-muted-foreground">{t("cookiePolicy.analytics.content")}</p>
              </div>

              <div>
                <h3 className="font-semibold">{t("cookiePolicy.marketing.title")}</h3>
                <p className="text-muted-foreground">{t("cookiePolicy.marketing.content")}</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("cookiePolicy.choicesTitle")}</h2>
            <ol className="list-decimal ml-6 mt-4 space-y-2 text-muted-foreground">
              <li>{t("cookiePolicy.choices.item1")}</li>
              <li>{t("cookiePolicy.choices.item2")}</li>
            </ol>
            <p className="text-muted-foreground mt-4">{t("cookiePolicy.choicesAdditional")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("cookiePolicy.exceptionsTitle")}</h2>
            <p className="text-muted-foreground mt-4">{t("cookiePolicy.exceptionsContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("cookiePolicy.violationsTitle")}</h2>
            <p className="text-muted-foreground mt-4">{t("cookiePolicy.violationsContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("cookiePolicy.versionTitle")}</h2>
            <div className="mt-4 text-sm [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-zinc-300 [&_td]:dark:border-zinc-700 [&_td]:px-6 [&_td]:py-3 [&_th]:border [&_th]:border-zinc-300 [&_th]:dark:border-zinc-700 [&_th]:bg-zinc-100 [&_th]:dark:bg-zinc-800 [&_th]:px-6 [&_th]:py-3 [&_th]:font-semibold [&_th]:text-left">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {t("cookiePolicy.versionContent")}
              </ReactMarkdown>
            </div>
          </section>

          <p className="italic text-sm text-muted-foreground mt-8">{t("cookiePolicy.lastReviewed")}</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
