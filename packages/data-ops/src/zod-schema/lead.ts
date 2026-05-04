import { z } from "zod";

export const LeadStatus = z.enum(["new", "contacted", "interested", "closed_won", "closed_lost"]);
export type LeadStatus = z.infer<typeof LeadStatus>;

const NormalizedEmail = z
	.string()
	.transform((s) => s.trim().toLowerCase())
	.pipe(z.string().email());

export const CreateLeadInput = z.object({
	email: NormalizedEmail,
});
export type CreateLeadInput = z.infer<typeof CreateLeadInput>;

export const LeadResponse = z.object({
	id: z.number(),
	email: z.string(),
	status: LeadStatus,
	notes: z.string().nullable(),
	consentGivenAt: z.date(),
	createdAt: z.date(),
	updatedAt: z.date(),
});
export type LeadResponse = z.infer<typeof LeadResponse>;

export const UpdateLeadStatusInput = z.object({
	status: LeadStatus,
});
export type UpdateLeadStatusInput = z.infer<typeof UpdateLeadStatusInput>;

export const UpdateLeadNotesInput = z.object({
	notes: z.string().nullable(),
});
export type UpdateLeadNotesInput = z.infer<typeof UpdateLeadNotesInput>;

export const NotifyLeadInput = z.object({
	email: z.string().email(),
	createdAt: z.coerce.date(),
});
export type NotifyLeadInput = z.infer<typeof NotifyLeadInput>;
