import { createFileRoute } from "@tanstack/react-router";
import { DashboardNav } from "@/components/navigation/dashboard-nav";
import { Footer } from "@/components/landing/footer";
import { SourceForm } from "@/components/sources/source-form";

export const Route = createFileRoute("/_auth/app/sources/new")({
	component: NewSourcePage,
});

function NewSourcePage() {
	return (
		<div className="min-h-dvh flex flex-col bg-background">
			<DashboardNav />
			<section className="flex-1 relative px-6 lg:px-8 pt-32 pb-8">
				<div className="mx-auto max-w-4xl">
					<SourceForm mode="create" />
				</div>
			</section>
			<Footer />
		</div>
	);
}
