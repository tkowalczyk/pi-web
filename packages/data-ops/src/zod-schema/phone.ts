import { z } from "zod";

export function normalizePolishPhone(phone: string): string {
  let cleaned = phone.replace(/\s+/g, "").replace(/\+/g, "");

  if (cleaned.startsWith("48")) {
    cleaned = cleaned.substring(2);
  }

  if (cleaned.length !== 9) {
    throw new Error("Invalid phone number length");
  }

  if (!/^\d{9}$/.test(cleaned)) {
    throw new Error("Phone number must contain only digits");
  }

  return `+48 ${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)}`;
}

export const phoneSchema = z.string()
  .transform((val) => normalizePolishPhone(val))
  .refine((val) => /^\+48 \d{3} \d{3} \d{3}$/.test(val), {
    message: "Invalid Polish phone format",
  });

// Input schemas
export const UpdatePhoneInput = z.object({
  phone: z.string().transform((val) => {
    if (!val || val.trim() === "") {
      throw new Error("Phone number is required");
    }
    return normalizePolishPhone(val);
  }),
});

export type UpdatePhoneInput = z.infer<typeof UpdatePhoneInput>;
