import { z } from "zod";
import { insertLead } from "@repo/data-ops/queries/leads";

export class TurnstileVerificationError extends Error {
	constructor(message = "Turnstile verification failed") {
		super(message);
		this.name = "TurnstileVerificationError";
	}
}

export const SubmitLeadInput = z.object({
	email: z
		.string()
		.transform((s) => s.trim().toLowerCase())
		.pipe(z.string().email()),
	consent: z.literal(true),
	turnstileToken: z.string().min(1),
});

export type SubmitLeadInput = z.infer<typeof SubmitLeadInput>;

export interface SubmitLeadDeps {
	verifyToken: (token: string) => Promise<{ success: boolean }>;
	now?: () => Date;
	notify?: (input: { email: string; createdAt: Date }) => Promise<unknown>;
}

export interface SubmitLeadResult {
	success: true;
}

export async function submitLeadHandler(
	rawInput: unknown,
	deps: SubmitLeadDeps,
): Promise<SubmitLeadResult> {
	const input = SubmitLeadInput.parse(rawInput);

	const verification = await deps.verifyToken(input.turnstileToken);
	if (!verification.success) {
		throw new TurnstileVerificationError();
	}

	const consentGivenAt = (deps.now ?? (() => new Date()))();
	await insertLead({ email: input.email, consentGivenAt });

	if (deps.notify) {
		try {
			await deps.notify({ email: input.email, createdAt: consentGivenAt });
		} catch (err) {
			console.warn("Lead notification failed", err);
		}
	}

	return { success: true };
}
