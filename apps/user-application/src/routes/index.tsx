import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { checkSession } from "@/core/functions/session";
import { LandingNav } from "@/components/navigation/landing-nav";
import { Footer } from "@/components/landing/footer";
import { HowItWorks } from "@/components/landing/how-it-works";
import { UseCases } from "@/components/landing/use-cases";
import { LeadCaptureForm } from "@/components/leads/lead-capture-form";
import type { SupportedLanguage } from "@/lib/parse-accept-language";
import i18n from "@/lib/i18n";

const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

const META = {
	pl: {
		title: "powiadomienia.info | Twój rodzinny asystent",
		description:
			"Osobiste powiadomienia na Telegramie. Przypomnienia o śmieciach i urodzinach dla Ciebie i Twojej rodziny.",
		ogImage: "https://powiadomienia.info/og/og-pl.png",
	},
	en: {
		title: "powiadomienia.info | Your family notification hub",
		description:
			"Personal Telegram reminders for waste collection and family birthdays. Keep your household organised with one reliable hub.",
		ogImage: "https://powiadomienia.info/og/og-en.png",
	},
} as const satisfies Record<
	SupportedLanguage,
	{ title: string; description: string; ogImage: string }
>;

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const session = await checkSession();
		if (session?.user) {
			throw redirect({ to: "/app", replace: true });
		}
	},
	loader: async ({ context }) => {
		const initialLanguage = context.initialLanguage;
		if (i18n.language !== initialLanguage) {
			await i18n.changeLanguage(initialLanguage);
		}
		return {
			initialLanguage,
			turnstileSiteKey:
				(import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? TURNSTILE_TEST_SITE_KEY,
		};
	},
	component: LandingPage,
	head: ({ loaderData }) => {
		const lang: SupportedLanguage = loaderData?.initialLanguage ?? "pl";
		const meta = META[lang];
		return {
			meta: [
				{ title: meta.title },
				{ name: "description", content: meta.description },
				{ property: "og:title", content: meta.title },
				{ property: "og:description", content: meta.description },
				{ property: "og:url", content: "https://powiadomienia.info" },
				{ property: "og:type", content: "website" },
				{ property: "og:image", content: meta.ogImage },
				{ property: "og:locale", content: lang === "pl" ? "pl_PL" : "en_US" },
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: meta.title },
				{ name: "twitter:description", content: meta.description },
				{ name: "twitter:image", content: meta.ogImage },
			],
			links: [
				{ rel: "alternate", hrefLang: "pl", href: "https://powiadomienia.info/" },
				{ rel: "alternate", hrefLang: "en", href: "https://powiadomienia.info/" },
				{ rel: "alternate", hrefLang: "x-default", href: "https://powiadomienia.info/" },
			],
		};
	},
});

function LandingPage() {
	const { t, i18n } = useTranslation();
	const { turnstileSiteKey, initialLanguage } = Route.useLoaderData();

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		const stored = localStorage.getItem("ui-language");
		if (!stored && i18n.language !== initialLanguage) {
			i18n.changeLanguage(initialLanguage);
		}
	}, [initialLanguage, i18n]);

	return (
		<div className="min-h-dvh flex flex-col bg-background">
			<LandingNav />
			<main className="flex-1">
				<section className="px-6 lg:px-8 pt-28 pb-16" aria-labelledby="hero-title">
					<div className="mx-auto w-full max-w-2xl text-center">
						<span className="inline-block text-xs uppercase tracking-widest text-primary/80 mb-4">
							{t("landing.earlyAccessLabel")}
						</span>
						<h1
							id="hero-title"
							className="text-3xl sm:text-5xl font-bold tracking-tight mb-5 text-balance"
						>
							{t("landing.heroTitle")}
						</h1>
						<p className="text-lg text-muted-foreground text-balance">
							{t("landing.heroSubtitle")}
						</p>
					</div>
				</section>

				<section className="px-6 lg:px-8 pb-20" aria-label={t("landing.earlyAccessLabel")}>
					<div className="mx-auto w-full max-w-xl">
						<p className="text-sm text-muted-foreground text-center mb-4">
							{t("landing.earlyAccessHint")}
						</p>
						<LeadCaptureForm siteKey={turnstileSiteKey} />
					</div>
				</section>

				<HowItWorks />
				<UseCases />
			</main>
			<Footer />
		</div>
	);
}
