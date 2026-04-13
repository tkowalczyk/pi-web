import { createServerFn } from "@tanstack/react-start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import { getDeliveryLogFiltered } from "@repo/data-ops/queries/delivery";
import { z } from "zod";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

const DeliveryLogInput = z.object({
	sourceId: z.number().optional(),
	status: z.enum(["success", "failure"]).optional(),
	limit: z.number().min(1).max(500).optional(),
});

export const getMyDeliveryLog = baseFunction
	.inputValidator((data) => DeliveryLogInput.parse(data))
	.handler(async (ctx) => {
		return getDeliveryLogFiltered({
			sourceId: ctx.data.sourceId,
			status: ctx.data.status,
			limit: ctx.data.limit,
		});
	});
