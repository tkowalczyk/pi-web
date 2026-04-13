import { z } from "zod";

export const HouseholdResponse = z.object({
	id: z.number(),
	name: z.string(),
	timezone: z.string(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const UpdateHouseholdInput = z.object({
	timezone: z.string(),
});

export type HouseholdResponse = z.infer<typeof HouseholdResponse>;
export type UpdateHouseholdInput = z.infer<typeof UpdateHouseholdInput>;

export const HouseholdRoleResponse = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type HouseholdRoleResponse = z.infer<typeof HouseholdRoleResponse>;
