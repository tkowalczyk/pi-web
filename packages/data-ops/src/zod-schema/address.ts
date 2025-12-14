import { z } from "zod";

// Response schemas
export const CityResponse = z.object({
  id: z.number(),
  name: z.string(),
});

export const StreetResponse = z.object({
  id: z.number(),
  name: z.string(),
});

export const AddressResponse = z.object({
  id: z.number(),
  userId: z.string(),
  cityId: z.number(),
  cityName: z.string().nullable(),
  streetId: z.number(),
  streetName: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CityResponse = z.infer<typeof CityResponse>;
export type StreetResponse = z.infer<typeof StreetResponse>;
export type AddressResponse = z.infer<typeof AddressResponse>;

// Input schemas
export const CreateAddressInput = z.object({
  cityId: z.number(),
  streetId: z.number(),
  isDefault: z.boolean().default(false),
});

export const UpdateAddressInput = z.object({
  cityId: z.number().optional(),
  streetId: z.number().optional(),
  isDefault: z.boolean().optional(),
});

export const DeleteAddressInput = z.object({
  id: z.number(),
});

export const UpdateAddressWithIdInput = z.object({
  id: z.number(),
  data: UpdateAddressInput,
});

export type CreateAddressInput = z.infer<typeof CreateAddressInput>;
export type UpdateAddressInput = z.infer<typeof UpdateAddressInput>;
export type DeleteAddressInput = z.infer<typeof DeleteAddressInput>;
export type UpdateAddressWithIdInput = z.infer<typeof UpdateAddressWithIdInput>;
