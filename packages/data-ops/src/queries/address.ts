import { getDb } from "@/database/setup";
import { addresses, cities, streets } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getUserAddresses(userId: string) {
  const db = getDb();
  return await db
    .select({
      id: addresses.id,
      userId: addresses.userId,
      cityId: addresses.cityId,
      cityName: cities.name,
      streetId: addresses.streetId,
      streetName: streets.name,
      isDefault: addresses.isDefault,
      createdAt: addresses.createdAt,
      updatedAt: addresses.updatedAt,
    })
    .from(addresses)
    .leftJoin(cities, eq(addresses.cityId, cities.id))
    .leftJoin(streets, eq(addresses.streetId, streets.id))
    .where(eq(addresses.userId, userId));
}

export async function createAddress(
  userId: string,
  cityId: number,
  streetId: number,
  isDefault: boolean = false
) {
  const db = getDb();

  if (isDefault) {
    await db
      .update(addresses)
      .set({ isDefault: false })
      .where(eq(addresses.userId, userId));
  }

  const [address] = await db
    .insert(addresses)
    .values({ userId, cityId, streetId, isDefault })
    .returning();

  return address;
}

export async function updateAddress(
  addressId: number,
  data: { cityId?: number; streetId?: number; isDefault?: boolean }
) {
  const db = getDb();

  if (data.isDefault) {
    const [addr] = await db.select().from(addresses).where(eq(addresses.id, addressId));
    if (addr) {
      await db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, addr.userId));
    }
  }

  await db
    .update(addresses)
    .set(data)
    .where(eq(addresses.id, addressId));
}

export async function deleteAddress(addressId: number) {
  const db = getDb();
  await db.delete(addresses).where(eq(addresses.id, addressId));
}

export async function getCities() {
  const db = getDb();
  return await db.select({
    id: cities.id,
    name: cities.name,
  }).from(cities);
}

export async function getStreetsByCityId(cityId: number) {
  const db = getDb();
  return await db.select({
    id: streets.id,
    name: streets.name,
  })
  .from(streets)
  .where(eq(streets.cityId, cityId));
}
