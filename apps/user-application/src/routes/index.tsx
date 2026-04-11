import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Bell, ArrowRight } from "lucide-react";
import { authClient } from "@/components/auth/client";
import { LandingNav } from "@/components/navigation/landing-nav";
import { Footer } from "@/components/landing/footer";

import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/")({
	component: LandingPage,
	head: () => ({
		meta: [
			{ title: "powiadomienia.info - Przypomnienia SMS o wywozie śmieci" },
			{
				name: "description",
				content:
					"Nigdy nie przegap dnia odbioru odpadów. Wpisz adres i otrzymuj bezpłatne przypomnienia SMS o harmonogramie wywozu śmieci w Twojej okolicy.",
			},
			{ property: "og:url", content: "https://powiadomienia.info" },
			{ property: "og:type", content: "website" },
			{ name: "twitter:card", content: "summary_large_image" },
		],
	}),
});

function LandingPage() {
	const { t } = useTranslation();
	const { data: session } = authClient.useSession();
	const isLoggedIn = !!session?.user;

	return (
		<div className="min-h-dvh flex flex-col bg-background">
			<LandingNav />
			<section className="flex-1 relative px-6 lg:px-8 pt-32 pb-12">
				<div className="mx-auto max-w-5xl">
					{/* Hero */}
					<div className="text-center mb-16">
						<Badge variant="outline" className="mb-4">
							{t("landing.badge")}
						</Badge>
						<h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl mb-6 text-balance">
							{t("landing.neverMiss")}{" "}
							<span className="text-primary">{t("landing.collectionDay")}</span>
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
					<Card className="border-primary/20 bg-primary/5">
						<CardHeader>
							<CardTitle className="text-2xl text-balance">{t("landing.howItWorks")}</CardTitle>
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
										<p className="text-sm text-muted-foreground">
											{t("landing.addAddressDescription")}
										</p>
									</div>
								</div>

								<div className="flex flex-col items-center text-center space-y-3">
									<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
										<Phone className="h-6 w-6 text-primary" />
									</div>
									<div>
										<p className="font-semibold mb-1">2. {t("landing.addPhone")}</p>
										<p className="text-sm text-muted-foreground">
											{t("landing.addPhoneDescription")}
										</p>
									</div>
								</div>

								<div className="flex flex-col items-center text-center space-y-3">
									<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
										<Bell className="h-6 w-6 text-primary" />
									</div>
									<div>
										<p className="font-semibold mb-1">3. {t("landing.notifications")}</p>
										<p className="text-sm text-muted-foreground">
											{t("landing.notificationsDescription")}
										</p>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					<p className="text-center text-sm text-muted-foreground mt-12 mb-8">
						{t("landing.freeNotifications")}
					</p>
				</div>
			</section>
			<Footer />
		</div>
	);
}
