import { createServerFn } from "@tanstack/react-start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import {
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress
} from "@repo/data-ops/queries/address";
import { createDefaultNotificationPreferences } from "@repo/data-ops/queries/notification-preferences";
import {
  CreateAddressInput,
  DeleteAddressInput,
  UpdateAddressWithIdInput,
} from "@repo/data-ops/zod-schema/address";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

export const getMyAddresses = baseFunction.handler(async (ctx) => {
  return getUserAddresses(ctx.context.userId);
});

export const createMyAddress = baseFunction
  .inputValidator((data) => CreateAddressInput.parse(data))
  .handler(async (ctx) => {
    const address = await createAddress(
      ctx.context.userId,
      ctx.data.cityId,
      ctx.data.streetId,
      ctx.data.isDefault
    );

    if (address) {
      await createDefaultNotificationPreferences(ctx.context.userId, address.id);
    }

    return address;
  });

export const updateMyAddress = baseFunction
  .inputValidator((data) => UpdateAddressWithIdInput.parse(data))
  .handler(async (ctx) => {
    await updateAddress(ctx.data.id, ctx.data.data);
    return { success: true };
  });

export const deleteMyAddress = baseFunction
  .inputValidator((data) => DeleteAddressInput.parse(data))
  .handler(async (ctx) => {
    await deleteAddress(ctx.data.id);
    return { success: true };
  });
