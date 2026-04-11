import { z } from "zod";

export const StatsResponse = z.object({
	activeUsersCount: z.number(),
	lastUpdated: z.string().datetime(),
	expiresAt: z.string().datetime(),
});

export type StatsResponse = z.infer<typeof StatsResponse>;
