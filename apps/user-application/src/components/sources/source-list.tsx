import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DeleteSourceDialog } from "./delete-source-dialog";
import { triggerNotificationSource } from "@/core/functions/notification-sources";

const TYPE_ICONS: Record<string, string> = {
	waste_collection: "🗑",
	birthday: "🎂",
};

const TYPE_LABELS: Record<string, string> = {
	waste_collection: "Wywóz śmieci",
	birthday: "Urodziny",
};

interface SourceItem {
	id: number;
	name: string;
	type: string;
	enabled: boolean;
	alertBeforeHours: number | null;
	topicId: number | null;
	lastDelivery: {
		status: string;
		error: string | null;
		createdAt: Date;
	} | null;
	schedulerState: {
		nextAlarmAt: string | null;
		lastRunAt: string | null;
		lastRunSuccess: boolean | null;
		status: "idle" | "scheduled";
	} | null;
}

function formatAlarm(iso: string | null): string {
	if (!iso) return "—";
	return new Date(iso).toLocaleString("pl-PL", {
		timeZone: "Europe/Warsaw",
		dateStyle: "medium",
		timeStyle: "short",
	});
}

function TriggerButton({ sourceId }: { sourceId: number }) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: () => triggerNotificationSource({ data: { id: sourceId } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notification-sources"] });
		},
	});

	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={() => mutation.mutate()}
			disabled={mutation.isPending}
			title={t("sources.triggerNow", "Wyślij teraz")}
		>
			<Play className="h-4 w-4" />
		</Button>
	);
}

export function SourceList({ sources }: { sources: SourceItem[] }) {
	const { t } = useTranslation();

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold tracking-tight">
					{t("sources.title", "Źródła powiadomień")}
				</h2>
				<Button asChild>
					<Link to="/app/sources/new">
						<Plus className="mr-2 h-4 w-4" />
						{t("sources.add", "Dodaj źródło")}
					</Link>
				</Button>
			</div>

			{sources.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<p className="text-muted-foreground mb-4">
							{t("sources.empty", "Nie masz jeszcze żadnych źródeł powiadomień.")}
						</p>
						<Button asChild>
							<Link to="/app/sources/new">
								<Plus className="mr-2 h-4 w-4" />
								{t("sources.addFirst", "Dodaj pierwsze źródło")}
							</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4">
					{sources.map((source) => (
						<Card key={source.id} className="group">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<div className="flex items-center gap-3">
									<span className="text-2xl" role="img" aria-label={source.type}>
										{TYPE_ICONS[source.type] ?? "📌"}
									</span>
									<div>
										<CardTitle className="text-lg">{source.name}</CardTitle>
										<p className="text-sm text-muted-foreground">
											{TYPE_LABELS[source.type] ?? source.type}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<Badge variant={source.enabled ? "default" : "secondary"}>
										{source.enabled
											? t("sources.enabled", "Aktywne")
											: t("sources.disabled", "Wyłączone")}
									</Badge>
									{source.lastDelivery && (
										<Badge
											variant={source.lastDelivery.status === "success" ? "outline" : "destructive"}
										>
											{source.lastDelivery.status === "success"
												? t("sources.delivered", "Wysłane")
												: t("sources.failed", "Błąd")}
										</Badge>
									)}
								</div>
							</CardHeader>
							<CardContent>
								<dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm mb-3">
									{source.alertBeforeHours && (
										<div className="flex justify-between sm:block">
											<dt className="text-muted-foreground">
												{t("sources.alertBefore", "Alert: {{hours}}h przed", {
													hours: source.alertBeforeHours,
												})}
											</dt>
										</div>
									)}
									<div className="flex justify-between sm:block">
										<dt className="text-muted-foreground inline">
											{t("sources.nextAlarm", "Najbliższy alarm")}:{" "}
										</dt>
										<dd className="inline font-medium">
											{formatAlarm(source.schedulerState?.nextAlarmAt ?? null)}
										</dd>
									</div>
									<div className="flex justify-between sm:block">
										<dt className="text-muted-foreground inline">
											{t("sources.schedulerStatus", "Scheduler")}:{" "}
										</dt>
										<dd className="inline font-medium">
											{source.schedulerState?.status === "scheduled"
												? t("sources.statusScheduled", "zaplanowany")
												: t("sources.statusIdle", "bezczynny")}
										</dd>
									</div>
									<div className="flex justify-between sm:block">
										<dt className="text-muted-foreground inline">
											{t("sources.topicId", "Topic id")}:{" "}
										</dt>
										<dd className="inline font-medium">{source.topicId ?? "—"}</dd>
									</div>
									{source.schedulerState?.lastRunAt && (
										<div className="flex justify-between sm:block sm:col-span-2">
											<dt className="text-muted-foreground inline">
												{t("sources.lastRun", "Ostatni alarm")}:{" "}
											</dt>
											<dd className="inline font-medium">
												{formatAlarm(source.schedulerState.lastRunAt)}{" "}
												{source.schedulerState.lastRunSuccess === false && (
													<span className="text-destructive">({t("sources.failed", "Błąd")})</span>
												)}
											</dd>
										</div>
									)}
								</dl>
								<div className="flex items-center justify-end gap-2">
									<TriggerButton sourceId={source.id} />
									<Button variant="ghost" size="sm" asChild>
										<Link to="/app/sources/$sourceId/edit" params={{ sourceId: String(source.id) }}>
											<Pencil className="h-4 w-4" />
										</Link>
									</Button>
									<DeleteSourceDialog sourceId={source.id} sourceName={source.name} />
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
