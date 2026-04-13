import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
interface WasteScheduleEntry {
	type: string;
	dates: string[];
}

interface WasteConfigFieldsProps {
	address: string;
	schedule: WasteScheduleEntry[];
	onAddressChange: (address: string) => void;
	onScheduleChange: (schedule: WasteScheduleEntry[]) => void;
	errors?: Record<string, string>;
}

export function WasteConfigFields({
	address,
	schedule,
	onAddressChange,
	onScheduleChange,
	errors,
}: WasteConfigFieldsProps) {
	const { t } = useTranslation();

	const addEntry = () => {
		onScheduleChange([...schedule, { type: "", dates: [""] }]);
	};

	const removeEntry = (index: number) => {
		onScheduleChange(schedule.filter((_, i) => i !== index));
	};

	const updateEntryType = (index: number, newType: string) => {
		const updated = schedule.map((entry, i) =>
			i === index ? { type: newType, dates: entry.dates } : entry,
		);
		onScheduleChange(updated);
	};

	const updateEntryDates = (index: number, datesStr: string) => {
		const dates = datesStr
			.split(",")
			.map((d) => d.trim())
			.filter(Boolean);
		const updated = schedule.map((entry, i) =>
			i === index ? { type: entry.type, dates } : entry,
		);
		onScheduleChange(updated);
	};

	return (
		<div className="space-y-4">
			<div>
				<Label htmlFor="address">
					{t("sources.waste.address", "Adres")}
				</Label>
				<Input
					id="address"
					value={address}
					onChange={(e) => onAddressChange(e.target.value)}
					placeholder="ul. Kwiatowa 5"
				/>
				{errors?.address && (
					<p className="text-sm text-destructive mt-1">{errors.address}</p>
				)}
			</div>

			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<Label>{t("sources.waste.schedule", "Harmonogram")}</Label>
					<Button type="button" variant="outline" size="sm" onClick={addEntry}>
						<Plus className="h-4 w-4 mr-1" />
						{t("sources.waste.addEntry", "Dodaj typ")}
					</Button>
				</div>

				{schedule.map((entry, index) => (
					<div key={index} className="flex gap-2 items-start">
						<div className="flex-1">
							<Input
								value={entry.type}
								onChange={(e) => updateEntryType(index, e.target.value)}
								placeholder={t("sources.waste.wasteType", "Typ (np. szkło)")}
							/>
						</div>
						<div className="flex-[2]">
							<Input
								value={entry.dates.join(", ")}
								onChange={(e) => updateEntryDates(index, e.target.value)}
								placeholder="2026-04-15, 2026-05-15"
							/>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => removeEntry(index)}
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				))}
				{errors?.schedule && (
					<p className="text-sm text-destructive">{errors.schedule}</p>
				)}
			</div>
		</div>
	);
}
