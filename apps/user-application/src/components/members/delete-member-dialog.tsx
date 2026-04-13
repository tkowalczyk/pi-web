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
import { removeMyHouseholdMember } from "@/core/functions/household-members";
import { useTranslation } from "react-i18next";

export function DeleteMemberDialog({
	memberId,
	memberName,
}: {
	memberId: number;
	memberName: string;
}) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: () => removeMyHouseholdMember({ data: { memberId } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["household-members"] });
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
					<DialogTitle>{t("members.deleteTitle")}</DialogTitle>
					<DialogDescription>
						{t("members.deleteDescription", { name: memberName })}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">{t("common.cancel")}</Button>
					</DialogClose>
					<Button
						variant="destructive"
						onClick={() => mutation.mutate()}
						disabled={mutation.isPending}
					>
						{mutation.isPending ? t("common.deleting") : t("common.delete")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
