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
import { deleteMyNotificationSource } from "@/core/functions/notification-sources";
import { useTranslation } from "react-i18next";

export function DeleteSourceDialog({
	sourceId,
	sourceName,
}: {
	sourceId: number;
	sourceName: string;
}) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: () => deleteMyNotificationSource({ data: { id: sourceId } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notification-sources"] });
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
					<DialogTitle>{t("sources.deleteTitle", "Usuń źródło")}</DialogTitle>
					<DialogDescription>
						{t(
							"sources.deleteDescription",
							'Czy na pewno chcesz usunąć "{{name}}"? Tej operacji nie można cofnąć.',
							{ name: sourceName },
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
