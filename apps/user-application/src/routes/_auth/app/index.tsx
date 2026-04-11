import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/core/functions/profile";

import { DashboardNav } from "@/components/navigation/dashboard-nav";
import { Footer } from "@/components/landing/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhoneForm } from "@/components/profile/phone-form";
import { Phone } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_auth/app/")({
	component: Dashboard,
	loader: async ({ context: { queryClient } }) => {
		await queryClient.prefetchQuery({
			queryKey: ["profile"],
			queryFn: () => getMyProfile(),
		});
	},
});

function Dashboard() {
	const { t } = useTranslation();
	const { data: profile } = useSuspenseQuery({
		queryKey: ["profile"],
		queryFn: () => getMyProfile(),
	});

	const hasPhone = !!profile?.phone;

	return (
		<div className="min-h-dvh flex flex-col bg-background">
			<DashboardNav />

			{/* Hero Section */}
			<section className="flex-1 relative px-6 lg:px-8 pt-32 pb-8">
				<div className="mx-auto max-w-7xl">
					<div className="text-center mb-12">
						<h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl text-balance">
							{t("dashboard.yourDashboard")}
						</h1>
						{!hasPhone && (
							<p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
								{t("dashboard.completeSetup")}
							</p>
						)}
					</div>

					{/* Main Content Grid */}
					<div className="grid gap-8 lg:grid-cols-2">
						{/* Profile Card */}
						<Card className="group hover:shadow-xl transition-all duration-300">
							<CardHeader>
								<div className="flex items-center justify-between mb-2">
									<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
										<Phone className="h-5 w-5 text-primary" />
									</div>
									<Badge variant="outline">{t("dashboard.profile")}</Badge>
								</div>
								<CardTitle>{t("dashboard.contactInformation")}</CardTitle>
								<CardDescription>{t("dashboard.contactDescription")}</CardDescription>
							</CardHeader>
							<CardContent>
								<PhoneForm user={profile} />
							</CardContent>
						</Card>
					</div>
				</div>
			</section>
			<Footer />
		</div>
	);
}
