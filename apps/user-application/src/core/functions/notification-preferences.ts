import { createServerFn } from "@tanstack/react-start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import {
  getUserNotificationPreferences,
  updateNotificationPreference
} from "@repo/data-ops/queries/notification-preferences";
import { z } from "zod";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

export const getMyNotificationPreferences = baseFunction
  .inputValidator((data) => z.object({ addressId: z.number().optional() }).parse(data))
  .handler(async (ctx) => {
    return getUserNotificationPreferences(ctx.context.userId, ctx.data.addressId);
  });

export const updateMyNotificationPreference = baseFunction
  .inputValidator((data) => z.object({
    id: z.number(),
    hour: z.number().min(0).max(23).optional(),
    minute: z.number().min(0).max(59).optional(),
    enabled: z.boolean().optional(),
  }).parse(data))
  .handler(async (ctx) => {
    await updateNotificationPreference(ctx.data.id, {
      hour: ctx.data.hour,
      minute: ctx.data.minute,
      enabled: ctx.data.enabled,
    });
    return { success: true };
  });
