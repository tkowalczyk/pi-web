import { z } from "zod";

export const CoverageStatsResponse = z.object({
  citiesCount: z.number(),
  streetsCount: z.number(),
  wasteSchedulesCount: z.number(),
  activeUsersCount: z.number(),
  lastUpdated: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export type CoverageStatsResponse = z.infer<typeof CoverageStatsResponse>;
