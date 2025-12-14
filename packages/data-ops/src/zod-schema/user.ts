import { z } from "zod";

// Response schemas
export const UserProfileResponse = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
});

export type UserProfileResponse = z.infer<typeof UserProfileResponse>;
