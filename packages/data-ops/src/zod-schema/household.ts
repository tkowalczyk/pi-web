import { z } from "zod";

export const HouseholdResponse = z.object({
	id: z.number(),
	name: z.string(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type HouseholdResponse = z.infer<typeof HouseholdResponse>;

export const HouseholdRoleResponse = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type HouseholdRoleResponse = z.infer<typeof HouseholdRoleResponse>;
