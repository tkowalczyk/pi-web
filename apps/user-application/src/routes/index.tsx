import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { checkSession } from "@/core/functions/session";
import { LandingNav } from "@/components/navigation/landing-nav";
import { Footer } from "@/components/landing/footer";
import { LeadCaptureForm } from "@/components/leads/lead-capture-form";

const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const session = await checkSession();
		if (session?.user) {
			throw redirect({ to: "/app", replace: true });
		}
	},
	loader: () => ({
		turnstileSiteKey:
			(import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? TURNSTILE_TEST_SITE_KEY,
	}),
	component: LandingPage,
	head: () => ({
		meta: [
			{ title: "powiadomienia.info — osobisty hub powiadomień" },
			{
				name: "description",
				content:
					"Zarządzaj rodzinnymi i osobistymi powiadomieniami w jednym miejscu — wywóz odpadów, urodziny i inne przypomnienia.",
			},
			{ property: "og:url", content: "https://powiadomienia.info" },
			{ property: "og:type", content: "website" },
			{ name: "twitter:card", content: "summary_large_image" },
		],
	}),
});

function LandingPage() {
	const { t } = useTranslation();
	const { turnstileSiteKey } = Route.useLoaderData();

	return (
		<div className="min-h-dvh flex flex-col bg-background">
			<LandingNav />
			<section className="flex-1 px-6 lg:px-8 pt-24 pb-12">
				<div className="mx-auto w-full max-w-xl">
					<div className="text-center mb-8">
						<h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-3 text-balance">
							{t("landing.heroTitle", "Osobisty hub powiadomień")}
						</h1>
						<p className="text-muted-foreground">
							{t(
								"landing.heroSubtitle",
								"Zostaw e-mail — odezwiemy się, gdy uruchomimy wcześniejszy dostęp.",
							)}
						</p>
					</div>
					<LeadCaptureForm siteKey={turnstileSiteKey} />
				</div>
			</section>
			<Footer />
		</div>
	);
}
