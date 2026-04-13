import { z } from "zod";

export const HouseholdMemberResponse = z.object({
	id: z.number(),
	householdId: z.number(),
	userId: z.string(),
	roleId: z.number(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type HouseholdMemberResponse = z.infer<typeof HouseholdMemberResponse>;

export const AddMemberInput = z.object({
	householdId: z.number(),
	userId: z.string(),
	roleId: z.number(),
});

export type AddMemberInput = z.infer<typeof AddMemberInput>;

export const UpdateMemberRoleInput = z.object({
	memberId: z.number(),
	roleId: z.number(),
});

export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleInput>;

export const AddMemberByEmailInput = z.object({
	email: z.string().email(),
	roleId: z.number(),
});

export type AddMemberByEmailInput = z.infer<typeof AddMemberByEmailInput>;

export const RemoveMemberInput = z.object({
	memberId: z.number(),
});

export type RemoveMemberInput = z.infer<typeof RemoveMemberInput>;
