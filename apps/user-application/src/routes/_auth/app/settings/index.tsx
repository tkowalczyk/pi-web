import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getMyHouseholdSettings } from "@/core/functions/household-settings";
import { DashboardNav } from "@/components/navigation/dashboard-nav";
import { Footer } from "@/components/landing/footer";
import { TimezoneForm } from "@/components/settings/timezone-form";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_auth/app/settings/")({
	component: SettingsPage,
	loader: async ({ context: { queryClient } }) => {
		await queryClient.prefetchQuery({
			queryKey: ["household-settings"],
			queryFn: () => getMyHouseholdSettings(),
		});
	},
});

function SettingsPage() {
	const { t } = useTranslation();
	const { data: settings } = useSuspenseQuery({
		queryKey: ["household-settings"],
		queryFn: () => getMyHouseholdSettings(),
	});

	return (
		<div className="min-h-dvh flex flex-col bg-background">
			<DashboardNav />
			<section className="flex-1 relative px-6 lg:px-8 pt-32 pb-8">
				<div className="mx-auto max-w-4xl">
					<div className="space-y-6">
						<h2 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h2>
						<TimezoneForm currentTimezone={settings?.timezone ?? "Europe/Warsaw"} />
					</div>
				</div>
			</section>
			<Footer />
		</div>
	);
}
