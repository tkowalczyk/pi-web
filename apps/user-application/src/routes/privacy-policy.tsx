import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LandingNav } from "@/components/navigation/landing-nav";
import { Footer } from "@/components/landing/footer";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col">
      <LandingNav />
      <main className="flex-1 px-6 py-16 w-full">
        <h1 className="text-4xl font-bold mb-12 text-center">{t("footer.privacyPolicy")}</h1>
        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8">
          <section className="border-l-4 border-primary/20 pl-6">
            <h2 className="text-primary">{t("privacyPolicy.statementSummary")}</h2>
            <p className="text-muted-foreground">{t("privacyPolicy.statementSummaryContent")}</p>

            <div className="space-y-4 mt-6">
              <div>
                <h3 className="text-lg">{t("privacyPolicy.whoWillUse")}</h3>
                <p className="text-muted-foreground">{t("privacyPolicy.whoWillUseContent")}</p>
              </div>
              <div>
                <h3 className="text-lg">{t("privacyPolicy.whatFor")}</h3>
                <div className="text-muted-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {t("privacyPolicy.whatForContent")}
                  </ReactMarkdown>
                </div>
              </div>
              <div>
                <h3 className="text-lg">{t("privacyPolicy.whatIfContact")}</h3>
                <p className="text-muted-foreground">{t("privacyPolicy.whatIfContactContent")}</p>
              </div>
              <div>
                <h3 className="text-lg">{t("privacyPolicy.whatStored")}</h3>
                <div className="text-muted-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {t("privacyPolicy.whatStoredContent")}
                  </ReactMarkdown>
                </div>
              </div>
              <div>
                <h3 className="text-lg">{t("privacyPolicy.whatShared")}</h3>
                <p className="text-muted-foreground">{t("privacyPolicy.whatSharedContent")}</p>
              </div>
              <div>
                <h3 className="text-lg">{t("privacyPolicy.howLong")}</h3>
                <p className="text-muted-foreground">{t("privacyPolicy.howLongContent")}</p>
              </div>
              <div>
                <h3 className="text-lg">{t("privacyPolicy.whoAccess")}</h3>
                <p className="text-muted-foreground">{t("privacyPolicy.whoAccessContent")}</p>
              </div>
              <div>
                <h3 className="text-lg">{t("privacyPolicy.howSecure")}</h3>
                <p className="text-muted-foreground">{t("privacyPolicy.howSecureContent")}</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("privacyPolicy.aboutPolicy")}</h2>
            <p className="text-muted-foreground mt-4">{t("privacyPolicy.aboutPolicyContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("privacyPolicy.principles")}</h2>
            <p className="text-muted-foreground mt-4">{t("privacyPolicy.principlesContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("privacyPolicy.whoWeAre")}</h2>
            <div className="text-muted-foreground mt-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {t("privacyPolicy.whoWeAreContent")}
              </ReactMarkdown>
            </div>

            <div className="ml-6 mt-6 space-y-4">
              <div>
                <h3 className="font-semibold">{t("privacyPolicy.article27")}</h3>
                <p className="text-muted-foreground">{t("privacyPolicy.article27Content")}</p>
              </div>
              <div>
                <h4 className="ml-4 font-medium">{t("privacyPolicy.ukRep")}</h4>
                <p className="ml-4 text-muted-foreground">{t("privacyPolicy.ukRepContent")}</p>
              </div>
              <div>
                <h4 className="ml-4 font-medium">{t("privacyPolicy.euRep")}</h4>
                <p className="ml-4 text-muted-foreground">{t("privacyPolicy.euRepContent")}</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("privacyPolicy.toWhom")}</h2>
            <p className="text-muted-foreground mt-4">{t("privacyPolicy.toWhomContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("privacyPolicy.whatApplies")}</h2>
            <p className="text-muted-foreground mt-4">{t("privacyPolicy.whatAppliesContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("privacyPolicy.howCollected")}</h2>
            <div className="text-muted-foreground mt-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {t("privacyPolicy.howCollectedContent")}
              </ReactMarkdown>
            </div>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("privacyPolicy.changePrefs")}</h2>
            <p className="text-muted-foreground mt-4">{t("privacyPolicy.changePrefsContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("privacyPolicy.optingOut")}</h2>
            <p className="text-muted-foreground mt-4">{t("privacyPolicy.optingOutContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("privacyPolicy.howStore")}</h2>
            <p className="text-muted-foreground mt-4">{t("privacyPolicy.howStoreContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("privacyPolicy.obligations")}</h2>
            <p className="text-muted-foreground mt-4">{t("privacyPolicy.obligationsContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("privacyPolicy.thirdParties")}</h2>
            <div className="mt-4 text-sm [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-zinc-300 [&_td]:dark:border-zinc-700 [&_td]:px-6 [&_td]:py-3 [&_th]:border [&_th]:border-zinc-300 [&_th]:dark:border-zinc-700 [&_th]:bg-zinc-100 [&_th]:dark:bg-zinc-800 [&_th]:px-6 [&_th]:py-3 [&_th]:font-semibold [&_th]:text-left">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {t("privacyPolicy.thirdPartiesContent")}
              </ReactMarkdown>
            </div>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("privacyPolicy.security")}</h2>
            <p className="text-muted-foreground mt-4">{t("privacyPolicy.securityContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("privacyPolicy.cookies")}</h2>
            <p className="text-muted-foreground mt-4">{t("privacyPolicy.cookiesContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("privacyPolicy.contacting")}</h2>
            <p className="text-muted-foreground mt-4">{t("privacyPolicy.contactingContent")}</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
