import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { verifyTurnstileToken } from "@/core/turnstile";
import { submitLeadHandler, SubmitLeadInput } from "@/core/leads/submit-lead";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import {
	listLeads,
	updateLeadStatus,
	updateLeadNotes,
	deleteLead,
} from "@repo/data-ops/queries/leads";
import { LeadStatus, LeadResponse } from "@repo/data-ops/zod-schema/lead";

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

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

export const getLeads = baseFunction.handler(async () => {
	const rows = await listLeads();
	return LeadResponse.array().parse(rows);
});

const UpdateStatusInput = z.object({
	id: z.number(),
	status: LeadStatus,
});

export const updateMyLeadStatus = baseFunction
	.inputValidator((data) => UpdateStatusInput.parse(data))
	.handler(async (ctx) => {
		const updated = await updateLeadStatus(ctx.data.id, ctx.data.status);
		if (!updated) throw new Error("Lead not found");
		return updated;
	});

const UpdateNotesInput = z.object({
	id: z.number(),
	notes: z.string().nullable(),
});

export const updateMyLeadNotes = baseFunction
	.inputValidator((data) => UpdateNotesInput.parse(data))
	.handler(async (ctx) => {
		const updated = await updateLeadNotes(ctx.data.id, ctx.data.notes);
		if (!updated) throw new Error("Lead not found");
		return updated;
	});

export const deleteMyLead = baseFunction
	.inputValidator((data) => z.object({ id: z.number() }).parse(data))
	.handler(async (ctx) => {
		await deleteLead(ctx.data.id);
		return { success: true };
	});
