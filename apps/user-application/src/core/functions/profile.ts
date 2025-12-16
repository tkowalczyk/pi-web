import { createServerFn } from "@tanstack/react-start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import { getUserProfile, updateUserPhone, updateUserLanguage as updateLanguage } from "@repo/data-ops/queries/user";
import { UpdatePhoneInput } from "@repo/data-ops/zod-schema/phone";
import { z } from "zod";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

const LanguageInput = z.object({
  language: z.enum(["pl", "en"]),
});

export const getMyProfile = baseFunction.handler(async (ctx) => {
  return getUserProfile(ctx.context.userId);
});

export const updateMyPhone = baseFunction
  .inputValidator((data) => UpdatePhoneInput.parse(data))
  .handler(async (ctx) => {
    return updateUserPhone(ctx.context.userId, ctx.data.phone);
  });

export const updateUserLanguage = baseFunction
  .inputValidator((data) => LanguageInput.parse(data))
  .handler(async (ctx) => {
    return updateLanguage(ctx.context.userId, ctx.data.language);
  });
