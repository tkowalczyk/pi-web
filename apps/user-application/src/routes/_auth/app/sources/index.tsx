import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getMyNotificationSources } from "@/core/functions/notification-sources";
import { DashboardNav } from "@/components/navigation/dashboard-nav";
import { Footer } from "@/components/landing/footer";
import { SourceList } from "@/components/sources/source-list";

export const Route = createFileRoute("/_auth/app/sources/")({
	component: SourcesPage,
	loader: async ({ context: { queryClient } }) => {
		await queryClient.prefetchQuery({
			queryKey: ["notification-sources"],
			queryFn: () => getMyNotificationSources(),
		});
	},
});

function SourcesPage() {
	const { data: sources } = useSuspenseQuery({
		queryKey: ["notification-sources"],
		queryFn: () => getMyNotificationSources(),
	});

	return (
		<div className="min-h-dvh flex flex-col bg-background">
			<DashboardNav />
			<section className="flex-1 relative px-6 lg:px-8 pt-32 pb-8">
				<div className="mx-auto max-w-4xl">
					<SourceList sources={sources ?? []} />
				</div>
			</section>
			<Footer />
		</div>
	);
}
