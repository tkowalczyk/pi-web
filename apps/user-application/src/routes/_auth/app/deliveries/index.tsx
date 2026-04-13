import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { getMyDeliveryLog } from "@/core/functions/delivery-log";
import { getMyNotificationSources } from "@/core/functions/notification-sources";
import { DashboardNav } from "@/components/navigation/dashboard-nav";
import { Footer } from "@/components/landing/footer";
import { DeliveryLogTable } from "@/components/deliveries/delivery-log-table";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_auth/app/deliveries/")({
	component: DeliveriesPage,
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.prefetchQuery({
				queryKey: ["delivery-log", {}],
				queryFn: () => getMyDeliveryLog({ data: {} }),
			}),
			queryClient.prefetchQuery({
				queryKey: ["notification-sources"],
				queryFn: () => getMyNotificationSources(),
			}),
		]);
	},
});

function DeliveriesPage() {
	const { t } = useTranslation();
	const [sourceId, setSourceId] = React.useState<string | undefined>();
	const [status, setStatus] = React.useState<string | undefined>();

	const filters = {
		sourceId: sourceId ? Number(sourceId) : undefined,
		status: status as "success" | "failure" | undefined,
	};

	const { data: entries } = useQuery({
		queryKey: ["delivery-log", filters],
		queryFn: () => getMyDeliveryLog({ data: filters }),
	});

	const { data: sources } = useSuspenseQuery({
		queryKey: ["notification-sources"],
		queryFn: () => getMyNotificationSources(),
	});

	const sourceOptions = (sources ?? []).map((s) => ({ id: s.id, name: s.name }));

	return (
		<div className="min-h-dvh flex flex-col bg-background">
			<DashboardNav />
			<section className="flex-1 relative px-6 lg:px-8 pt-32 pb-8">
				<div className="mx-auto max-w-5xl">
					<h2 className="text-2xl font-bold tracking-tight mb-6">
						{t("deliveries.title", "Log dostarczeń")}
					</h2>
					<DeliveryLogTable
						entries={entries ?? []}
						sources={sourceOptions}
						selectedSourceId={sourceId}
						selectedStatus={status}
						onSourceChange={setSourceId}
						onStatusChange={setStatus}
					/>
				</div>
			</section>
			<Footer />
		</div>
	);
}
