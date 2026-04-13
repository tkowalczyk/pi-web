import * as React from "react";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { addMyHouseholdMember, getMyHouseholdRoles } from "@/core/functions/household-members";
import { useTranslation } from "react-i18next";

const ROLE_LABELS: Record<string, string> = {
	admin: "members.admin",
	member: "members.member",
};

export function AddMemberDialog() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const [open, setOpen] = React.useState(false);
	const [email, setEmail] = React.useState("");
	const [roleId, setRoleId] = React.useState<string>("");
	const [error, setError] = React.useState<string | null>(null);

	const { data: roles } = useSuspenseQuery({
		queryKey: ["household-roles"],
		queryFn: () => getMyHouseholdRoles(),
	});

	const mutation = useMutation({
		mutationFn: () => addMyHouseholdMember({ data: { email, roleId: Number(roleId) } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["household-members"] });
			setOpen(false);
			setEmail("");
			setRoleId("");
			setError(null);
		},
		onError: (err: Error) => {
			setError(err.message);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (!email || !roleId) return;
		mutation.mutate();
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<Plus className="mr-2 h-4 w-4" />
					{t("members.add")}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>{t("members.add")}</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="email">{t("members.email")}</Label>
							<Input
								id="email"
								type="email"
								placeholder={t("members.emailPlaceholder")}
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="role">{t("members.role")}</Label>
							<Select value={roleId} onValueChange={setRoleId}>
								<SelectTrigger>
									<SelectValue placeholder={t("members.selectRole")} />
								</SelectTrigger>
								<SelectContent>
									{roles?.map((role) => (
										<SelectItem key={role.id} value={String(role.id)}>
											{t(ROLE_LABELS[role.name] ?? role.name)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						{error && <p className="text-sm text-destructive">{error}</p>}
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="outline">
								{t("common.cancel")}
							</Button>
						</DialogClose>
						<Button type="submit" disabled={mutation.isPending || !email || !roleId}>
							{mutation.isPending ? t("members.adding") : t("members.add")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
