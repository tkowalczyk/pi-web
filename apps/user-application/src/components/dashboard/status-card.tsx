import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Circle, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";

interface StatusCardProps {
	hasAddress: boolean;
	hasPhone: boolean;
}

type Phase = "phone" | "address" | "complete";

function getPhase(hasPhone: boolean, hasAddress: boolean): Phase {
	if (!hasPhone) return "phone";
	if (!hasAddress) return "address";
	return "complete";
}

export function StatusCard({ hasAddress, hasPhone }: StatusCardProps) {
	const { t } = useTranslation();

	const phase = getPhase(hasPhone, hasAddress);
	const completedSteps = [hasPhone, hasAddress].filter(Boolean).length;

	const steps = [
		{ key: "phone", done: hasPhone, label: t("dashboard.status.steps.phone") },
		{ key: "address", done: hasAddress, label: t("dashboard.status.steps.address") },
	];

	// Fully complete
	if (phase === "complete") {
		return (
			<Card className="mb-8 border-green-500/20 bg-green-500/5">
				<CardContent className="pt-6">
					<div className="flex items-start gap-4">
						<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
							<CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
						</div>
						<div className="flex-1">
							<h3 className="text-lg font-semibold text-green-700 dark:text-green-500">
								{t("dashboard.status.complete.title")}
							</h3>
							<div className="flex items-center gap-2 mt-1">
								<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
								<span className="text-sm text-green-600 dark:text-green-400">
									{t("dashboard.status.complete.smsEnabled")}
								</span>
							</div>
							<div className="mt-3 border-t border-border/50 pt-3">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Smartphone className="h-4 w-4" />
									{t("dashboard.smsNotificationTimes")}
								</div>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	// In progress - show steps
	return (
		<Card className="mb-8">
			<CardContent className="pt-6">
				<div className="flex items-start gap-4">
					<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
						<Smartphone className="h-6 w-6 text-primary" />
					</div>
					<div className="flex-1">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-semibold">{t(`dashboard.status.${phase}.title`)}</h3>
							<span className="text-sm text-muted-foreground">{completedSteps}/2</span>
						</div>
						<p className="text-sm text-muted-foreground mt-1">
							{t(`dashboard.status.${phase}.description`)}
						</p>

						{/* Progress steps */}
						<div className="mt-4 space-y-2">
							{steps.map((step) => (
								<div key={step.key} className="flex items-center gap-2 text-sm">
									{step.done ? (
										<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
									) : (
										<Circle className="h-4 w-4 text-muted-foreground" />
									)}
									<span className={step.done ? "text-muted-foreground line-through" : ""}>
										{step.label}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
