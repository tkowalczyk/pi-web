import { createServerFn } from "@tanstack/react-start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import { getWasteScheduleByUserId } from "@repo/data-ops/queries/waste";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

export const getMyWasteSchedule = baseFunction.handler(async (ctx) => {
  return getWasteScheduleByUserId(ctx.context.userId);
});
