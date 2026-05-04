import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { updateMyLeadNotes } from "@/core/functions/leads";
import { normalizeNotes } from "./normalize-notes";

interface NotesEditorProps {
	leadId: number;
	initialNotes: string | null;
}

export function NotesEditor({ leadId, initialNotes }: NotesEditorProps) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const [value, setValue] = React.useState(initialNotes ?? "");

	const mutation = useMutation({
		mutationFn: (notes: string | null) => updateMyLeadNotes({ data: { id: leadId, notes } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["leads"] });
		},
	});

	const isDirty = (initialNotes ?? "") !== value;

	return (
		<div className="space-y-2">
			<Textarea
				value={value}
				onChange={(e) => setValue(e.target.value)}
				placeholder={t("leads.notesPlaceholder", "Notatki…")}
				rows={3}
			/>
			<div className="flex justify-end gap-2">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => setValue(initialNotes ?? "")}
					disabled={!isDirty || mutation.isPending}
				>
					{t("common.cancel", "Anuluj")}
				</Button>
				<Button
					type="button"
					size="sm"
					onClick={() => mutation.mutate(normalizeNotes(value))}
					disabled={!isDirty || mutation.isPending}
				>
					{mutation.isPending ? t("common.saving", "Zapisywanie…") : t("common.save", "Zapisz")}
				</Button>
			</div>
		</div>
	);
}
