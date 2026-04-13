import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getNotificationSource } from "@/core/functions/notification-sources";
import { DashboardNav } from "@/components/navigation/dashboard-nav";
import { Footer } from "@/components/landing/footer";
import { SourceForm } from "@/components/sources/source-form";

export const Route = createFileRoute("/_auth/app/sources/$sourceId/edit")({
	component: EditSourcePage,
	loader: async ({ params, context: { queryClient } }) => {
		const sourceId = Number(params.sourceId);
		await queryClient.prefetchQuery({
			queryKey: ["notification-source", sourceId],
			queryFn: () => getNotificationSource({ data: { id: sourceId } }),
		});
	},
});

function EditSourcePage() {
	const { sourceId } = Route.useParams();
	const id = Number(sourceId);

	const { data: source } = useSuspenseQuery({
		queryKey: ["notification-source", id],
		queryFn: () => getNotificationSource({ data: { id } }),
	});

	if (!source) {
		return <div>Source not found</div>;
	}

	return (
		<div className="min-h-dvh flex flex-col bg-background">
			<DashboardNav />
			<section className="flex-1 relative px-6 lg:px-8 pt-32 pb-8">
				<div className="mx-auto max-w-4xl">
					<SourceForm
						mode="edit"
						initialData={{
							id: source.id,
							name: source.name,
							type: source.type,
							config: source.config as Record<string, any>,
							alertBeforeHours: source.alertBeforeHours,
						}}
					/>
				</div>
			</section>
			<Footer />
		</div>
	);
}
