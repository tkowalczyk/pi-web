import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import {
	createMyNotificationSource,
	updateMyNotificationSource,
} from "@/core/functions/notification-sources";
import {
	SourceFormInput,
	SOURCE_TYPES,
	getAlertBeforeHoursDefault,
} from "@repo/data-ops/zod-schema/source-form-schema";
import { WasteConfigFields } from "./waste-config-fields";
import { BirthdayConfigFields } from "./birthday-config-fields";

interface SourceFormProps {
	mode: "create" | "edit";
	initialData?: {
		id: number;
		name: string;
		type: string;
		config: Record<string, any>;
		alertBeforeHours: number | null;
	};
}

export function SourceForm({ mode, initialData }: SourceFormProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [name, setName] = React.useState(initialData?.name ?? "");
	const [type, setType] = React.useState(initialData?.type ?? "");
	const [alertBeforeHours, setAlertBeforeHours] = React.useState<string>(
		initialData?.alertBeforeHours?.toString() ?? "",
	);
	const [errors, setErrors] = React.useState<Record<string, string>>({});

	// Waste collection config state
	const [wasteAddress, setWasteAddress] = React.useState(
		(initialData?.config as any)?.address ?? "",
	);
	const [wasteSchedule, setWasteSchedule] = React.useState(
		(initialData?.config as any)?.schedule ?? [{ type: "", dates: [""] }],
	);

	// Birthday config state
	const [birthdays, setBirthdays] = React.useState(
		(initialData?.config as any)?.birthdays ?? [{ name: "", date: "" }],
	);

	const createMutation = useMutation({
		mutationFn: createMyNotificationSource,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notification-sources"] });
			navigate({ to: "/app/sources" });
		},
	});

	const updateMutation = useMutation({
		mutationFn: updateMyNotificationSource,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notification-sources"] });
			navigate({ to: "/app/sources" });
		},
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	const buildConfig = () => {
		if (type === "waste_collection") {
			return { address: wasteAddress, schedule: wasteSchedule };
		}
		if (type === "birthday") {
			return { birthdays };
		}
		return {};
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setErrors({});

		const config = buildConfig();
		const alertHours = alertBeforeHours
			? Number(alertBeforeHours)
			: undefined;

		const input = { name, type, config, alertBeforeHours: alertHours };
		const parsed = SourceFormInput.safeParse(input);

		if (!parsed.success) {
			const flat = parsed.error.flatten();
			const fieldErrors: Record<string, string> = {};
			for (const [key, msgs] of Object.entries(flat.fieldErrors)) {
				const first = msgs?.[0];
				if (first) fieldErrors[key] = first;
			}
			const formErr = flat.formErrors[0];
			if (formErr) fieldErrors._form = formErr;
			setErrors(fieldErrors);
			return;
		}

		if (mode === "create") {
			createMutation.mutate({ data: parsed.data });
		} else if (initialData) {
			updateMutation.mutate({
				data: {
					id: initialData.id,
					data: {
						name: parsed.data.name,
						config: parsed.data.config,
						alertBeforeHours: alertHours,
					},
				},
			});
		}
	};

	const handleTypeChange = (newType: string) => {
		setType(newType);
		if (!alertBeforeHours) {
			setAlertBeforeHours(String(getAlertBeforeHoursDefault(newType)));
		}
	};

	return (
		<Card className="max-w-2xl mx-auto">
			<CardHeader>
				<CardTitle>
					{mode === "create"
						? t("sources.createTitle", "Nowe źródło powiadomień")
						: t("sources.editTitle", "Edytuj źródło")}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<Label htmlFor="name">{t("sources.name", "Nazwa")}</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={t("sources.namePlaceholder", "np. Wywóz — ul. Kwiatowa")}
							aria-invalid={!!errors.name}
						/>
						{errors.name && (
							<p className="text-sm text-destructive mt-1">{errors.name}</p>
						)}
					</div>

					{mode === "create" && (
						<div>
							<Label>{t("sources.type", "Typ")}</Label>
							<Select value={type} onValueChange={handleTypeChange}>
								<SelectTrigger>
									<SelectValue placeholder={t("sources.selectType", "Wybierz typ")} />
								</SelectTrigger>
								<SelectContent>
									{SOURCE_TYPES.map((st) => (
										<SelectItem key={st.value} value={st.value}>
											{st.icon} {st.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{errors.type && (
								<p className="text-sm text-destructive mt-1">{errors.type}</p>
							)}
						</div>
					)}

					{type === "waste_collection" && (
						<WasteConfigFields
							address={wasteAddress}
							schedule={wasteSchedule}
							onAddressChange={setWasteAddress}
							onScheduleChange={setWasteSchedule}
							errors={errors}
						/>
					)}

					{type === "birthday" && (
						<BirthdayConfigFields
							birthdays={birthdays}
							onBirthdaysChange={setBirthdays}
							errors={errors}
						/>
					)}

					{type && (
						<div>
							<Label htmlFor="alertBeforeHours">
								{t("sources.alertBeforeHours", "Alert przed (godziny)")}
							</Label>
							<Input
								id="alertBeforeHours"
								type="number"
								min="1"
								value={alertBeforeHours}
								onChange={(e) => setAlertBeforeHours(e.target.value)}
								aria-invalid={!!errors.alertBeforeHours}
							/>
							{errors.alertBeforeHours && (
								<p className="text-sm text-destructive mt-1">
									{errors.alertBeforeHours}
								</p>
							)}
						</div>
					)}

					{errors._form && (
						<p className="text-sm text-destructive">{errors._form}</p>
					)}

					{(createMutation.error || updateMutation.error) && (
						<p className="text-sm text-destructive">
							{(createMutation.error || updateMutation.error)?.message}
						</p>
					)}

					<div className="flex gap-3 justify-end">
						<Button
							type="button"
							variant="outline"
							onClick={() => navigate({ to: "/app/sources" })}
						>
							{t("common.cancel", "Anuluj")}
						</Button>
						<Button type="submit" disabled={isPending || !type}>
							{isPending
								? t("common.saving", "Zapisywanie...")
								: mode === "create"
									? t("sources.create", "Utwórz")
									: t("sources.save", "Zapisz")}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
