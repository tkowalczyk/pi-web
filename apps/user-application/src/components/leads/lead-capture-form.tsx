import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { submitLead } from "@/core/functions/leads";
import { TurnstileWidget } from "./turnstile-widget";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LeadCaptureFormProps {
	siteKey: string;
}

export function LeadCaptureForm({ siteKey }: LeadCaptureFormProps) {
	const { t } = useTranslation();
	const [email, setEmail] = React.useState("");
	const [consent, setConsent] = React.useState(false);
	const [turnstileToken, setTurnstileToken] = React.useState("");
	const [emailTouched, setEmailTouched] = React.useState(false);
	const [submitted, setSubmitted] = React.useState(false);

	const handleToken = React.useCallback((token: string) => {
		setTurnstileToken(token);
	}, []);

	const mutation = useMutation({
		mutationFn: (data: { email: string; consent: true; turnstileToken: string }) =>
			submitLead({ data }),
		onSuccess: () => setSubmitted(true),
	});

	const emailValid = EMAIL_RE.test(email.trim());
	const formValid = emailValid && consent && turnstileToken.length > 0;
	const showEmailError = emailTouched && !emailValid && email.length > 0;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!formValid) return;
		mutation.mutate({
			email: email.trim(),
			consent: true,
			turnstileToken,
		});
	}

	if (submitted) {
		return (
			<div
				role="status"
				aria-live="polite"
				className="rounded-lg border border-primary/30 bg-primary/5 p-6 text-center"
			>
				<h2 className="text-xl font-semibold mb-2">{t("leads.thankYouTitle", "Dziękujemy!")}</h2>
				<p className="text-muted-foreground">
					{t("leads.thankYouBody", "Otrzymaliśmy Twój zapis. Odezwiemy się wkrótce.")}
				</p>
			</div>
		);
	}

	return (
		<form
			onSubmit={handleSubmit}
			noValidate
			className="space-y-4 rounded-lg border bg-card p-6 shadow-sm"
		>
			<div className="space-y-2">
				<Label htmlFor="lead-email">{t("leads.emailLabel", "Adres e-mail")}</Label>
				<Input
					id="lead-email"
					type="email"
					autoComplete="email"
					required
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					onBlur={() => setEmailTouched(true)}
					aria-invalid={showEmailError || undefined}
					aria-describedby={showEmailError ? "lead-email-error" : undefined}
				/>
				{showEmailError && (
					<p id="lead-email-error" className="text-sm text-destructive">
						{t("leads.emailInvalid", "Podaj poprawny adres e-mail.")}
					</p>
				)}
			</div>

			<div className="flex items-start gap-2">
				<Checkbox
					id="lead-consent"
					checked={consent}
					onCheckedChange={(v) => setConsent(v === true)}
					required
				/>
				<Label htmlFor="lead-consent" className="text-sm font-normal leading-snug">
					{t("leads.consentPrefix", "Wyrażam zgodę na przetwarzanie moich danych zgodnie z ")}
					<Link to="/privacy-policy" className="underline text-primary">
						{t("leads.consentLink", "polityką prywatności")}
					</Link>
					.
				</Label>
			</div>

			<TurnstileWidget siteKey={siteKey} onToken={handleToken} />

			{mutation.isError && (
				<p className="text-sm text-destructive" role="alert">
					{t("leads.submitError", "Coś poszło nie tak. Spróbuj ponownie.")}
				</p>
			)}

			<Button type="submit" disabled={!formValid || mutation.isPending} className="w-full">
				{mutation.isPending
					? t("leads.submitting", "Wysyłanie...")
					: t("leads.submit", "Zapisz mnie")}
			</Button>
		</form>
	);
}
