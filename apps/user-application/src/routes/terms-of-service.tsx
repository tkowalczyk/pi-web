import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LandingNav } from "@/components/navigation/landing-nav";
import { Footer } from "@/components/landing/footer";

export const Route = createFileRoute("/terms-of-service")({
  component: TermsOfServicePage,
});

function TermsOfServicePage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col">
      <LandingNav />
      <main className="flex-1 px-6 py-16 w-full">
        <h1 className="text-4xl font-bold mb-12 text-center">{t("footer.termsOfService")}</h1>
        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8">
          <div className="text-sm text-muted-foreground">
            <p>{t("termsOfService.lastUpdate")}</p>
          </div>

          <p className="uppercase font-semibold">{t("termsOfService.intro")}</p>

          <section>
            <h2 className="text-primary border-b pb-2">{t("termsOfService.agreementTitle")}</h2>
            <p className="text-muted-foreground mt-4">{t("termsOfService.agreementContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("termsOfService.definitionsTitle")}</h2>
            <ol className="list-decimal ml-6 mt-4 space-y-2 text-muted-foreground">
              <li>{t("termsOfService.definitions.item1")}</li>
              <li>{t("termsOfService.definitions.item2")}</li>
              <li>{t("termsOfService.definitions.item3")}</li>
            </ol>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("termsOfService.privacyNoticeTitle")}</h2>
            <p className="text-muted-foreground mt-4">{t("termsOfService.privacyNoticeContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("termsOfService.changesTitle")}</h2>
            <p className="text-muted-foreground mt-4">{t("termsOfService.changesContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("termsOfService.accessTitle")}</h2>
            <ol className="list-decimal ml-6 mt-4 space-y-2 text-muted-foreground">
              <li>{t("termsOfService.access.item1")}</li>
              <li>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {t("termsOfService.access.item2")}
                </ReactMarkdown>
              </li>
              <li>{t("termsOfService.access.item3")}</li>
            </ol>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("termsOfService.subscriptionsTitle")}</h2>
            <p className="text-muted-foreground mt-4">{t("termsOfService.subscriptionsContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("termsOfService.customerMaterialsTitle")}</h2>
            <p className="text-muted-foreground mt-4">{t("termsOfService.customerMaterialsContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("termsOfService.supportTitle")}</h2>
            <div className="ml-6 mt-6 space-y-4">
              <div>
                <h3 className="font-semibold">{t("termsOfService.support.title")}</h3>
                <p className="text-muted-foreground">{t("termsOfService.support.content")}</p>
              </div>
              <div>
                <h3 className="font-semibold">{t("termsOfService.serviceLevels.title")}</h3>
                <p className="text-muted-foreground">{t("termsOfService.serviceLevels.content")}</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("termsOfService.confidentialTitle")}</h2>
            <p className="text-muted-foreground mt-4">{t("termsOfService.confidentialContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("termsOfService.representationsTitle")}</h2>
            <div className="ml-6 mt-6 space-y-4">
              <div>
                <h3 className="font-semibold">{t("termsOfService.representations.mutual.title")}</h3>
                <p className="text-muted-foreground">{t("termsOfService.representations.mutual.content")}</p>
              </div>
              <div>
                <h3 className="font-semibold">{t("termsOfService.representations.customer.title")}</h3>
                <p className="text-muted-foreground">{t("termsOfService.representations.customer.content")}</p>
              </div>
              <div>
                <h3 className="font-semibold">{t("termsOfService.representations.disclaimer.title")}</h3>
                <p className="uppercase font-semibold">{t("termsOfService.representations.disclaimer.content")}</p>
              </div>
              <div>
                <h3 className="font-semibold">{t("termsOfService.representations.similarity.title")}</h3>
                <p className="text-muted-foreground">{t("termsOfService.representations.similarity.content")}</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("termsOfService.terminationTitle")}</h2>
            <p className="text-muted-foreground mt-4">{t("termsOfService.terminationContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("termsOfService.limitationTitle")}</h2>
            <p className="text-muted-foreground mt-4">{t("termsOfService.limitationContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("termsOfService.indemnificationTitle")}</h2>
            <p className="text-muted-foreground mt-4">{t("termsOfService.indemnificationContent")}</p>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("termsOfService.generalTitle")}</h2>
            <ol className="list-decimal ml-6 mt-4 space-y-2 text-muted-foreground">
              <li>{t("termsOfService.general.item1")}</li>
              <li>{t("termsOfService.general.item2")}</li>
              <li>{t("termsOfService.general.item3")}</li>
            </ol>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("termsOfService.exhibitA.title")}</h2>
            <ol className="list-decimal ml-6 mt-4 space-y-2 text-muted-foreground">
              <li>{t("termsOfService.exhibitA.item1")}</li>
              <li>{t("termsOfService.exhibitA.item2")}</li>
              <li>{t("termsOfService.exhibitA.item3")}</li>
            </ol>
          </section>

          <section>
            <h2 className="text-primary border-b pb-2">{t("termsOfService.exhibitB.title")}</h2>
            <ol className="list-decimal ml-6 mt-4 space-y-2 text-muted-foreground">
              <li>{t("termsOfService.exhibitB.item1")}</li>
              <li>{t("termsOfService.exhibitB.item2")}</li>
              <li>{t("termsOfService.exhibitB.item3")}</li>
            </ol>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
