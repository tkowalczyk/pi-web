import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteMyLead } from "@/core/functions/leads";
import { useTranslation } from "react-i18next";

export function DeleteLeadDialog({ leadId, email }: { leadId: number; email: string }) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: () => deleteMyLead({ data: { id: leadId } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["leads"] });
		},
	});

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="ghost" size="sm">
					<Trash2 className="h-4 w-4 text-destructive" />
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("leads.deleteTitle", "Usuń lead")}</DialogTitle>
					<DialogDescription>
						{t(
							"leads.deleteDescription",
							'Czy na pewno chcesz usunąć lead "{{email}}"? Tej operacji nie można cofnąć.',
							{ email },
						)}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">{t("common.cancel", "Anuluj")}</Button>
					</DialogClose>
					<Button
						variant="destructive"
						onClick={() => mutation.mutate()}
						disabled={mutation.isPending}
					>
						{mutation.isPending ? t("common.deleting", "Usuwanie...") : t("common.delete", "Usuń")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
