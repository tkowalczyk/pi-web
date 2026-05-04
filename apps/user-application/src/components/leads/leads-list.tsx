import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LeadStatus } from "@repo/data-ops/zod-schema/lead";
import { updateMyLeadStatus } from "@/core/functions/leads";
import { NotesEditor } from "./notes-editor";
import { DeleteLeadDialog } from "./delete-lead-dialog";

const STATUS_VALUES: LeadStatus[] = ["new", "contacted", "interested", "closed_won", "closed_lost"];

export interface LeadRow {
	id: number;
	email: string;
	status: LeadStatus;
	notes: string | null;
	consentGivenAt: Date;
	createdAt: Date;
	updatedAt: Date;
}

function formatTimestamp(d: Date): string {
	return new Date(d).toLocaleString("pl-PL", {
		timeZone: "Europe/Warsaw",
		dateStyle: "medium",
		timeStyle: "short",
	});
}

function snippet(notes: string | null, max = 60): string {
	if (!notes) return "—";
	const trimmed = notes.trim();
	if (trimmed.length <= max) return trimmed;
	return `${trimmed.slice(0, max - 1)}…`;
}

function StatusSelect({ leadId, status }: { leadId: number; status: LeadStatus }) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: (next: LeadStatus) => updateMyLeadStatus({ data: { id: leadId, status: next } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["leads"] });
		},
	});

	return (
		<Select
			value={status}
			onValueChange={(v) => mutation.mutate(v as LeadStatus)}
			disabled={mutation.isPending}
		>
			<SelectTrigger className="w-[160px]">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{STATUS_VALUES.map((s) => (
					<SelectItem key={s} value={s}>
						{t(`leads.status.${s}`, s)}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

export function LeadsList({ leads }: { leads: LeadRow[] }) {
	const { t } = useTranslation();
	const [expandedId, setExpandedId] = React.useState<number | null>(null);

	if (leads.length === 0) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center py-12">
					<p className="text-muted-foreground">{t("leads.empty", "Brak zgłoszonych leadów.")}</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-[40px]" />
						<TableHead>{t("leads.email", "Email")}</TableHead>
						<TableHead>{t("leads.submittedAt", "Zgłoszono")}</TableHead>
						<TableHead>{t("leads.status.label", "Status")}</TableHead>
						<TableHead>{t("leads.notes", "Notatki")}</TableHead>
						<TableHead className="text-right">{t("leads.actions", "Akcje")}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{leads.map((lead) => {
						const isExpanded = expandedId === lead.id;
						return (
							<React.Fragment key={lead.id}>
								<TableRow
									data-state={isExpanded ? "selected" : undefined}
									className="cursor-pointer"
									onClick={() => setExpandedId(isExpanded ? null : lead.id)}
								>
									<TableCell>
										<Button variant="ghost" size="sm" className="h-7 w-7 p-0">
											{isExpanded ? (
												<ChevronDown className="h-4 w-4" />
											) : (
												<ChevronRight className="h-4 w-4" />
											)}
										</Button>
									</TableCell>
									<TableCell className="font-medium">{lead.email}</TableCell>
									<TableCell className="text-muted-foreground">
										{formatTimestamp(lead.createdAt)}
									</TableCell>
									<TableCell onClick={(e) => e.stopPropagation()}>
										<StatusSelect leadId={lead.id} status={lead.status} />
									</TableCell>
									<TableCell className="max-w-[260px] truncate text-muted-foreground">
										{snippet(lead.notes)}
									</TableCell>
									<TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
										<DeleteLeadDialog leadId={lead.id} email={lead.email} />
									</TableCell>
								</TableRow>
								{isExpanded && (
									<TableRow data-state="selected">
										<TableCell colSpan={6} className="bg-muted/30 whitespace-normal">
											<div className="py-2">
												<p className="text-sm font-medium mb-2">
													{t("leads.notesFull", "Notatki (pełne)")}
												</p>
												<NotesEditor leadId={lead.id} initialNotes={lead.notes} />
											</div>
										</TableCell>
									</TableRow>
								)}
							</React.Fragment>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
