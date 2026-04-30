import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { verifyTurnstileToken } from "@/core/turnstile";
import { submitLeadHandler, SubmitLeadInput } from "@/core/leads/submit-lead";

export const submitLead = createServerFn()
	.inputValidator((data) => SubmitLeadInput.parse(data))
	.handler(async (ctx) => {
		const secret = env.TURNSTILE_SECRET_KEY;
		return submitLeadHandler(ctx.data, {
			verifyToken: (token) => verifyTurnstileToken(token, secret),
		});
	});
