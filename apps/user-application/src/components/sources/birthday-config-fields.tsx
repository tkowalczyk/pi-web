import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface BirthdayEntry {
	name: string;
	date: string;
}

interface BirthdayConfigFieldsProps {
	birthdays: BirthdayEntry[];
	onBirthdaysChange: (birthdays: BirthdayEntry[]) => void;
	errors?: Record<string, string>;
}

export function BirthdayConfigFields({
	birthdays,
	onBirthdaysChange,
	errors,
}: BirthdayConfigFieldsProps) {
	const { t } = useTranslation();

	const addEntry = () => {
		onBirthdaysChange([...birthdays, { name: "", date: "" }]);
	};

	const removeEntry = (index: number) => {
		onBirthdaysChange(birthdays.filter((_, i) => i !== index));
	};

	const updateEntry = (index: number, field: keyof BirthdayEntry, value: string) => {
		const updated = birthdays.map((entry, i) =>
			i === index ? { name: entry.name, date: entry.date, [field]: value } : entry,
		);
		onBirthdaysChange(updated);
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<Label>{t("sources.birthday.list", "Lista urodzin")}</Label>
				<Button type="button" variant="outline" size="sm" onClick={addEntry}>
					<Plus className="h-4 w-4 mr-1" />
					{t("sources.birthday.add", "Dodaj osobę")}
				</Button>
			</div>

			{birthdays.map((entry, index) => (
				<div key={index} className="flex gap-2 items-start">
					<div className="flex-1">
						<Input
							value={entry.name}
							onChange={(e) => updateEntry(index, "name", e.target.value)}
							placeholder={t("sources.birthday.name", "Imię")}
						/>
					</div>
					<div className="w-32">
						<Input
							value={entry.date}
							onChange={(e) => updateEntry(index, "date", e.target.value)}
							placeholder="MM-DD"
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
			{errors?.birthdays && (
				<p className="text-sm text-destructive">{errors.birthdays}</p>
			)}
		</div>
	);
}
