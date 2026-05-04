import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getLeads } from "@/core/functions/leads";
import { DashboardNav } from "@/components/navigation/dashboard-nav";
import { Footer } from "@/components/landing/footer";
import { LeadsList } from "@/components/leads/leads-list";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_auth/app/leads/")({
	component: LeadsPage,
	loader: async ({ context: { queryClient } }) => {
		await queryClient.prefetchQuery({
			queryKey: ["leads"],
			queryFn: () => getLeads(),
		});
	},
});

function LeadsPage() {
	const { t } = useTranslation();
	const { data: leads } = useSuspenseQuery({
		queryKey: ["leads"],
		queryFn: () => getLeads(),
	});

	return (
		<div className="min-h-dvh flex flex-col bg-background">
			<DashboardNav />
			<section className="flex-1 relative px-6 lg:px-8 pt-32 pb-8">
				<div className="mx-auto max-w-6xl space-y-6">
					<h2 className="text-2xl font-bold tracking-tight">{t("leads.title", "Leady")}</h2>
					<LeadsList leads={leads ?? []} />
				</div>
			</section>
			<Footer />
		</div>
	);
}
