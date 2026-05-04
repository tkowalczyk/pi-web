import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { verifyTurnstileToken } from "@/core/turnstile";
import { submitLeadHandler, SubmitLeadInput } from "@/core/leads/submit-lead";

export const submitLead = createServerFn()
	.inputValidator((data) => SubmitLeadInput.parse(data))
	.handler(async (ctx) => {
		const secret = env.TURNSTILE_SECRET_KEY;
		const dataService = env.DATA_SERVICE;

		return submitLeadHandler(ctx.data, {
			verifyToken: (token) => verifyTurnstileToken(token, secret),
			notify: dataService
				? async (input) => {
						const res = await dataService.fetch(
							new Request("https://internal/worker/leads/notify", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									email: input.email,
									createdAt: input.createdAt.toISOString(),
								}),
							}),
						);
						if (!res.ok) {
							throw new Error(`lead notify failed: HTTP ${res.status}`);
						}
					}
				: undefined,
		});
	});
