import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { DeleteMemberDialog } from "./delete-member-dialog";
import { AddMemberDialog } from "./add-member-dialog";

const ROLE_LABELS: Record<string, string> = {
	admin: "members.admin",
	member: "members.member",
};

interface MemberItem {
	memberId: number;
	userId: string;
	householdId: number;
	roleId: number;
	role: string;
	userName: string;
	userEmail: string;
}

export function MemberList({ members }: { members: MemberItem[] }) {
	const { t } = useTranslation();

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold tracking-tight">{t("members.title")}</h2>
				<AddMemberDialog />
			</div>

			{members.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<p className="text-muted-foreground mb-4">{t("members.empty")}</p>
						<AddMemberDialog />
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4">
					{members.map((member) => (
						<Card key={member.memberId} className="group">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<div className="flex items-center gap-3">
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
										<span className="text-sm font-medium text-primary">
											{member.userName?.charAt(0).toUpperCase() ?? "?"}
										</span>
									</div>
									<div>
										<CardTitle className="text-lg">{member.userName}</CardTitle>
										<p className="text-sm text-muted-foreground">{member.userEmail}</p>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<Badge variant={member.role === "admin" ? "default" : "secondary"}>
										{t(ROLE_LABELS[member.role] ?? member.role)}
									</Badge>
									<DeleteMemberDialog memberId={member.memberId} memberName={member.userName} />
								</div>
							</CardHeader>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
