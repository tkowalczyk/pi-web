import { useTranslation } from "react-i18next";
import { Trash2, Cake } from "lucide-react";

export function UseCases() {
	const { t } = useTranslation();

	const cases = [
		{
			icon: Trash2,
			title: t("landing.useCases.case1Title"),
			body: t("landing.useCases.case1Body"),
		},
		{
			icon: Cake,
			title: t("landing.useCases.case2Title"),
			body: t("landing.useCases.case2Body"),
		},
	];

	return (
		<section id="use-cases" className="px-6 lg:px-8 py-20" aria-labelledby="use-cases-title">
			<div className="mx-auto max-w-5xl">
				<div className="text-center mb-12">
					<h2 id="use-cases-title" className="text-2xl font-bold tracking-tight sm:text-3xl mb-3">
						{t("landing.useCases.title")}
					</h2>
					<p className="text-muted-foreground max-w-2xl mx-auto">
						{t("landing.useCases.subtitle")}
					</p>
				</div>
				<div className="grid gap-6 sm:grid-cols-2">
					{cases.map((useCase) => {
						const Icon = useCase.icon;
						return (
							<article key={useCase.title} className="rounded-lg border bg-card p-6 shadow-sm">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
									<Icon className="h-5 w-5" aria-hidden="true" />
								</div>
								<h3 className="text-lg font-semibold mb-2">{useCase.title}</h3>
								<p className="text-sm text-muted-foreground leading-relaxed">{useCase.body}</p>
							</article>
						);
					})}
				</div>
			</div>
		</section>
	);
}
