import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getMyHouseholdMembers, getMyHouseholdRoles } from "@/core/functions/household-members";
import { DashboardNav } from "@/components/navigation/dashboard-nav";
import { Footer } from "@/components/landing/footer";
import { MemberList } from "@/components/members/member-list";

export const Route = createFileRoute("/_auth/app/members/")({
	component: MembersPage,
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.prefetchQuery({
				queryKey: ["household-members"],
				queryFn: () => getMyHouseholdMembers(),
			}),
			queryClient.prefetchQuery({
				queryKey: ["household-roles"],
				queryFn: () => getMyHouseholdRoles(),
			}),
		]);
	},
});

function MembersPage() {
	const { data: members } = useSuspenseQuery({
		queryKey: ["household-members"],
		queryFn: () => getMyHouseholdMembers(),
	});

	return (
		<div className="min-h-dvh flex flex-col bg-background">
			<DashboardNav />
			<section className="flex-1 relative px-6 lg:px-8 pt-32 pb-8">
				<div className="mx-auto max-w-4xl">
					<MemberList members={members ?? []} />
				</div>
			</section>
			<Footer />
		</div>
	);
}
