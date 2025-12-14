import { createServerFn } from "@tanstack/react-start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import { getUserProfile, updateUserPhone } from "@repo/data-ops/queries/user";
import { UpdatePhoneInput } from "@repo/data-ops/zod-schema/phone";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

export const getMyProfile = baseFunction.handler(async (ctx) => {
  return getUserProfile(ctx.context.userId);
});

export const updateMyPhone = baseFunction
  .inputValidator((data) => UpdatePhoneInput.parse(data))
  .handler(async (ctx) => {
    return updateUserPhone(ctx.context.userId, ctx.data.phone);
  });
