import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "validation.password.minLength")
  .max(128, "validation.password.maxLength")
  .regex(/[A-Z]/, "validation.password.uppercase")
  .regex(/[a-z]/, "validation.password.lowercase")
  .regex(/[0-9]/, "validation.password.number");

export const emailSchema = z
  .string()
  .email("validation.email.invalid")
  .min(1, "validation.email.required");

export const registerSchema = z
  .object({
    name: z.string().min(2, "validation.name.minLength"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "validation.password.noMatch",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "validation.password.required"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "validation.password.required"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "validation.password.noMatch",
    path: ["confirmPassword"],
  });
