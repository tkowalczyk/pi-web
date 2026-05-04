import { useTranslation } from "react-i18next";
import { ClipboardList, MessagesSquare, Smile } from "lucide-react";

export function HowItWorks() {
	const { t } = useTranslation();

	const steps = [
		{
			icon: ClipboardList,
			title: t("landing.howItWorks.step1Title"),
			body: t("landing.howItWorks.step1Body"),
		},
		{
			icon: MessagesSquare,
			title: t("landing.howItWorks.step2Title"),
			body: t("landing.howItWorks.step2Body"),
		},
		{
			icon: Smile,
			title: t("landing.howItWorks.step3Title"),
			body: t("landing.howItWorks.step3Body"),
		},
	];

	return (
		<section
			id="how-it-works"
			className="px-6 lg:px-8 py-20 border-t bg-muted/30"
			aria-labelledby="how-it-works-title"
		>
			<div className="mx-auto max-w-5xl">
				<div className="text-center mb-12">
					<h2
						id="how-it-works-title"
						className="text-2xl font-bold tracking-tight sm:text-3xl mb-3"
					>
						{t("landing.howItWorks.title")}
					</h2>
					<p className="text-muted-foreground max-w-2xl mx-auto">
						{t("landing.howItWorks.subtitle")}
					</p>
				</div>
				<ol className="grid gap-8 sm:grid-cols-3">
					{steps.map((step, idx) => {
						const Icon = step.icon;
						return (
							<li
								key={step.title}
								className="rounded-lg border bg-card p-6 shadow-sm flex flex-col items-start"
							>
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
									<Icon className="h-5 w-5" aria-hidden="true" />
								</div>
								<div className="text-xs font-mono text-muted-foreground mb-1">
									{String(idx + 1).padStart(2, "0")}
								</div>
								<h3 className="text-lg font-semibold mb-2">{step.title}</h3>
								<p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
							</li>
						);
					})}
				</ol>
			</div>
		</section>
	);
}
