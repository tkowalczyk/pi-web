import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";

interface DeliveryLogEntry {
	id: number;
	sourceId: number;
	sourceName: string;
	channel: string;
	status: string;
	error: string | null;
	retryCount: number;
	createdAt: Date;
}

interface SourceOption {
	id: number;
	name: string;
}

interface DeliveryLogTableProps {
	entries: DeliveryLogEntry[];
	sources: SourceOption[];
	selectedSourceId: string | undefined;
	selectedStatus: string | undefined;
	onSourceChange: (value: string | undefined) => void;
	onStatusChange: (value: string | undefined) => void;
}

export function DeliveryLogTable({
	entries,
	sources,
	selectedSourceId,
	selectedStatus,
	onSourceChange,
	onStatusChange,
}: DeliveryLogTableProps) {
	const { t } = useTranslation();

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-4">
				<Select
					value={selectedSourceId ?? "all"}
					onValueChange={(v) => onSourceChange(v === "all" ? undefined : v)}
				>
					<SelectTrigger className="w-[200px]">
						<SelectValue placeholder={t("deliveries.allSources", "Wszystkie źródła")} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">{t("deliveries.allSources", "Wszystkie źródła")}</SelectItem>
						{sources.map((s) => (
							<SelectItem key={s.id} value={String(s.id)}>
								{s.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select
					value={selectedStatus ?? "all"}
					onValueChange={(v) => onStatusChange(v === "all" ? undefined : v)}
				>
					<SelectTrigger className="w-[160px]">
						<SelectValue placeholder={t("deliveries.allStatuses", "Wszystkie statusy")} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">{t("deliveries.allStatuses", "Wszystkie statusy")}</SelectItem>
						<SelectItem value="success">{t("deliveries.success", "Sukces")}</SelectItem>
						<SelectItem value="failure">{t("deliveries.failure", "Błąd")}</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{entries.length === 0 ? (
				<p className="text-muted-foreground text-center py-8">
					{t("deliveries.empty", "Brak wpisów w logu dostarczeń.")}
				</p>
			) : (
				<div className="rounded-md border overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b bg-muted/50">
								<th className="px-4 py-3 text-left font-medium">
									{t("deliveries.source", "Źródło")}
								</th>
								<th className="px-4 py-3 text-left font-medium">
									{t("deliveries.channel", "Kanał")}
								</th>
								<th className="px-4 py-3 text-left font-medium">
									{t("deliveries.status", "Status")}
								</th>
								<th className="px-4 py-3 text-left font-medium">{t("deliveries.error", "Błąd")}</th>
								<th className="px-4 py-3 text-right font-medium">
									{t("deliveries.retries", "Ponowienia")}
								</th>
								<th className="px-4 py-3 text-right font-medium">{t("deliveries.time", "Czas")}</th>
							</tr>
						</thead>
						<tbody>
							{entries.map((entry) => (
								<tr key={entry.id} className="border-b last:border-0">
									<td className="px-4 py-3">{entry.sourceName}</td>
									<td className="px-4 py-3">{entry.channel}</td>
									<td className="px-4 py-3">
										<Badge variant={entry.status === "success" ? "outline" : "destructive"}>
											{entry.status === "success"
												? t("deliveries.success", "Sukces")
												: t("deliveries.failure", "Błąd")}
										</Badge>
									</td>
									<td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
										{entry.error ?? "—"}
									</td>
									<td className="px-4 py-3 text-right">{entry.retryCount}</td>
									<td className="px-4 py-3 text-right whitespace-nowrap">
										{new Date(entry.createdAt).toLocaleString("pl-PL")}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
