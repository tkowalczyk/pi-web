import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMyHouseholdTimezone } from "@/core/functions/household-settings";
import { useTranslation } from "react-i18next";

const COMMON_TIMEZONES = [
	"Europe/Warsaw",
	"Europe/London",
	"Europe/Berlin",
	"Europe/Paris",
	"Europe/Rome",
	"Europe/Madrid",
	"Europe/Amsterdam",
	"Europe/Brussels",
	"Europe/Vienna",
	"Europe/Prague",
	"Europe/Stockholm",
	"Europe/Helsinki",
	"Europe/Athens",
	"Europe/Bucharest",
	"Europe/Kiev",
	"Europe/Moscow",
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"Asia/Tokyo",
	"Asia/Shanghai",
	"Asia/Kolkata",
	"Australia/Sydney",
	"Pacific/Auckland",
	"UTC",
];

export function TimezoneForm({ currentTimezone }: { currentTimezone: string }) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const [timezone, setTimezone] = React.useState(currentTimezone);

	const mutation = useMutation({
		mutationFn: () => updateMyHouseholdTimezone({ data: { timezone } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["household-settings"] });
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (timezone === currentTimezone) return;
		mutation.mutate();
	};

	const hasChanged = timezone !== currentTimezone;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("settings.timezone")}</CardTitle>
				<CardDescription>{t("settings.timezoneDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="timezone">{t("settings.timezone")}</Label>
						<Select value={timezone} onValueChange={setTimezone}>
							<SelectTrigger>
								<SelectValue placeholder={t("settings.selectTimezone")} />
							</SelectTrigger>
							<SelectContent>
								{COMMON_TIMEZONES.map((tz) => (
									<SelectItem key={tz} value={tz}>
										{tz.replace(/_/g, " ")}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{mutation.isSuccess && (
						<p className="text-sm text-green-600">
							{t("settings.timezoneUpdated", {
								count: mutation.data?.rescheduledCount ?? 0,
							})}
						</p>
					)}

					{mutation.isError && (
						<p className="text-sm text-destructive">{t("settings.timezoneError")}</p>
					)}

					<Button type="submit" disabled={!hasChanged || mutation.isPending}>
						{mutation.isPending ? t("common.saving") : t("common.save")}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
