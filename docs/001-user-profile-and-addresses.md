# Design Doc: User Profile, Addresses & Notification Preferences

## Overview

Future-proof address & notification system. Users start with 1 address, can add more later. Each address has customizable notification schedules (default: 19:00 day before, 7:00 same day). Phone field on auth_user for SMS delivery.

## Architecture Flow

```
Database (auth_user.phone + addresses + notification_preferences)
  ↓ (Drizzle schema + migrations)
Queries (data-ops/queries/)
  ↓ (getDb() + Drizzle ORM)
Server Functions (user-application/core/functions/)
  ↓ (Zod validation + protected middleware)
Dashboard Route (user-application/routes/_auth/app/)
  ↓ (TanStack Query + forms)
UI Display on /app (tabs: Profile, Addresses)
```

---

## 1. Database Layer

### 1.1 Update auth_user
**File:** `packages/data-ops/src/drizzle/auth-schema.ts`

```ts
export const auth_user = pgTable("auth_user", {
  // existing: id, name, email, emailVerified, image, createdAt, updatedAt
  phone: text("phone"), // Polish format: +48 xxx xxx xxx
});
```

### 1.2 New addresses Table
**File:** `packages/data-ops/src/drizzle/schema.ts`

```ts
export const addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => auth_user.id, { onDelete: "cascade" }),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: "restrict" }),
  streetId: integer("street_id").notNull().references(() => streets.id, { onDelete: "restrict" }),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("addresses_user_id_idx").on(table.userId),
  index("addresses_city_id_idx").on(table.cityId),
]);
```

### 1.3 New notification_preferences Table
**File:** `packages/data-ops/src/drizzle/schema.ts`

```ts
export const notification_preferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => auth_user.id, { onDelete: "cascade" }),
  addressId: integer("address_id").notNull().references(() => addresses.id, { onDelete: "cascade" }),
  notificationType: text("notification_type").notNull(), // "day_before" | "same_day"
  hour: integer("hour").notNull(), // 0-23 (CET/CEST)
  minute: integer("minute").default(0).notNull(), // 0-59
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("notif_prefs_user_id_idx").on(table.userId),
  index("notif_prefs_address_id_idx").on(table.addressId),
]);
```

### 1.4 Relations
**File:** `packages/data-ops/src/drizzle/relations.ts` (add to existing)

```ts
export const addressesRelations = relations(addresses, ({ one, many }) => ({
  user: one(auth_user, {
    fields: [addresses.userId],
    references: [auth_user.id],
  }),
  city: one(cities, {
    fields: [addresses.cityId],
    references: [cities.id],
  }),
  street: one(streets, {
    fields: [addresses.streetId],
    references: [streets.id],
  }),
  notificationPreferences: many(notification_preferences),
}));

export const notificationPreferencesRelations = relations(notification_preferences, ({ one }) => ({
  user: one(auth_user, {
    fields: [notification_preferences.userId],
    references: [auth_user.id],
  }),
  address: one(addresses, {
    fields: [notification_preferences.addressId],
    references: [addresses.id],
  }),
}));

export const authUserRelations = relations(auth_user, ({ many }) => ({
  addresses: many(addresses),
  notificationPreferences: many(notification_preferences),
}));
```

### 1.5 Generate & Apply Migration
```bash
cd packages/data-ops
pnpm run drizzle:dev:generate
pnpm run drizzle:dev:migrate
```

---

## 2. Data Layer

### 2.1 Phone Validation Schema
**File:** `packages/data-ops/src/zod-schema/phone.ts` (new)

```ts
import { z } from "zod";

// Polish phone: +48 xxx xxx xxx (13 chars with spaces)
const polishPhoneRegex = /^\+48 \d{3} \d{3} \d{3}$/;

export const phoneSchema = z.string().regex(polishPhoneRegex, "Invalid Polish phone format");

export const updatePhoneSchema = z.object({
  phone: phoneSchema.nullable(),
});

export type UpdatePhone = z.infer<typeof updatePhoneSchema>;
```

### 2.2 Profile Queries
**File:** `packages/data-ops/src/queries/user.ts` (new)

```ts
import { getDb } from "@/database/setup";
import { auth_user } from "@/drizzle/auth-schema";
import { eq } from "drizzle-orm";

export async function getUserProfile(userId: string) {
  const db = getDb();
  const [user] = await db
    .select({
      id: auth_user.id,
      name: auth_user.name,
      email: auth_user.email,
      phone: auth_user.phone,
    })
    .from(auth_user)
    .where(eq(auth_user.id, userId));
  return user;
}

export async function updateUserPhone(userId: string, phone: string | null) {
  const db = getDb();
  await db
    .update(auth_user)
    .set({ phone })
    .where(eq(auth_user.id, userId));
  return getUserProfile(userId);
}
```

### 2.3 Address Queries
**File:** `packages/data-ops/src/queries/address.ts` (new)

```ts
import { getDb } from "@/database/setup";
import { addresses } from "@/drizzle/schema";
import { cities, streets } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

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

  // If setting as default, unset others
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

  // If setting as default, unset others first
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
```

### 2.4 Notification Preferences Queries
**File:** `packages/data-ops/src/queries/notification-preferences.ts` (new)

```ts
import { getDb } from "@/database/setup";
import { notification_preferences } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

export async function getUserNotificationPreferences(userId: string, addressId?: number) {
  const db = getDb();
  const query = db
    .select()
    .from(notification_preferences)
    .where(eq(notification_preferences.userId, userId));

  if (addressId) {
    return await query.where(
      and(
        eq(notification_preferences.userId, userId),
        eq(notification_preferences.addressId, addressId)
      )
    );
  }

  return await query;
}

export async function createDefaultNotificationPreferences(userId: string, addressId: number) {
  const db = getDb();

  const defaults = [
    { userId, addressId, notificationType: "day_before", hour: 19, minute: 0, enabled: true },
    { userId, addressId, notificationType: "same_day", hour: 7, minute: 0, enabled: true },
  ];

  return await db
    .insert(notification_preferences)
    .values(defaults)
    .returning();
}

export async function updateNotificationPreference(
  id: number,
  data: { hour?: number; minute?: number; enabled?: boolean }
) {
  const db = getDb();
  await db
    .update(notification_preferences)
    .set(data)
    .where(eq(notification_preferences.id, id));
}
```

### 2.5 Rebuild data-ops
```bash
pnpm run build:data-ops
```

---

## 3. Backend Layer

### 3.1 Profile Server Functions
**File:** `apps/user-application/src/core/functions/profile.ts` (new)

```ts
import { createServerFn } from "@tanstack/start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import { getUserProfile, updateUserPhone } from "data-ops/queries/user";
import { updatePhoneSchema } from "data-ops/zod-schema/phone";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

export const getMyProfile = baseFunction.handler(async (ctx) => {
  return getUserProfile(ctx.context.userId);
});

export const updateMyPhone = baseFunction
  .inputValidator((data) => updatePhoneSchema.parse(data))
  .handler(async (ctx) => {
    return updateUserPhone(ctx.context.userId, ctx.data.phone);
  });
```

### 3.2 Address Server Functions
**File:** `apps/user-application/src/core/functions/addresses.ts` (new)

```ts
import { createServerFn } from "@tanstack/start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import {
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress
} from "data-ops/queries/address";
import { createDefaultNotificationPreferences } from "data-ops/queries/notification-preferences";
import { z } from "zod";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

const CreateAddressSchema = z.object({
  cityId: z.number(),
  streetId: z.number(),
  isDefault: z.boolean().default(false),
});

const UpdateAddressSchema = z.object({
  cityId: z.number().optional(),
  streetId: z.number().optional(),
  isDefault: z.boolean().optional(),
});

export const getMyAddresses = baseFunction.handler(async (ctx) => {
  return getUserAddresses(ctx.context.userId);
});

export const createMyAddress = baseFunction
  .inputValidator((data) => CreateAddressSchema.parse(data))
  .handler(async (ctx) => {
    const address = await createAddress(
      ctx.context.userId,
      ctx.data.cityId,
      ctx.data.streetId,
      ctx.data.isDefault
    );

    // Auto-create default notification preferences
    await createDefaultNotificationPreferences(ctx.context.userId, address.id);

    return address;
  });

export const updateMyAddress = baseFunction
  .inputValidator((data) => z.object({
    id: z.number(),
    data: UpdateAddressSchema,
  }).parse(data))
  .handler(async (ctx) => {
    await updateAddress(ctx.input.id, ctx.input.data);
    return { success: true };
  });

export const deleteMyAddress = baseFunction
  .inputValidator((data) => z.object({ id: z.number() }).parse(data))
  .handler(async (ctx) => {
    await deleteAddress(ctx.input.id);
    return { success: true };
  });
```

### 3.3 Notification Preferences Server Functions
**File:** `apps/user-application/src/core/functions/notification-preferences.ts` (new)

```ts
import { createServerFn } from "@tanstack/start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import {
  getUserNotificationPreferences,
  updateNotificationPreference
} from "data-ops/queries/notification-preferences";
import { z } from "zod";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

export const getMyNotificationPreferences = baseFunction
  .inputValidator((data) => z.object({ addressId: z.number().optional() }).parse(data))
  .handler(async (ctx) => {
    return getUserNotificationPreferences(ctx.context.userId, ctx.input.addressId);
  });

export const updateMyNotificationPreference = baseFunction
  .inputValidator((data) => z.object({
    id: z.number(),
    hour: z.number().min(0).max(23).optional(),
    minute: z.number().min(0).max(59).optional(),
    enabled: z.boolean().optional(),
  }).parse(data))
  .handler(async (ctx) => {
    await updateNotificationPreference(ctx.input.id, {
      hour: ctx.input.hour,
      minute: ctx.input.minute,
      enabled: ctx.input.enabled,
    });
    return { success: true };
  });
```

### 3.4 API Endpoints

**File:** `apps/user-application/src/routes/api/cities/index.tsx` (new)

```tsx
import { createAPIFileRoute } from "@tanstack/start/api";
import { getCities } from "data-ops/queries/address";

export const Route = createAPIFileRoute("/api/cities")({
  GET: async () => {
    const cities = await getCities();
    return Response.json(cities);
  },
});
```

**File:** `apps/user-application/src/routes/api/cities/$cityId/streets.tsx` (new)

```tsx
import { createAPIFileRoute } from "@tanstack/start/api";
import { getStreetsByCityId } from "data-ops/queries/address";

export const Route = createAPIFileRoute("/api/cities/$cityId/streets")({
  GET: async ({ params }) => {
    const streets = await getStreetsByCityId(Number(params.cityId));
    return Response.json(streets);
  },
});
```

---

## 4. Frontend Layer

### 4.1 Dashboard Route
**File:** `apps/user-application/src/routes/_auth/app/index.tsx` (update)

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/core/functions/profile";
import { getMyAddresses } from "@/core/functions/addresses";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhoneForm } from "@/components/profile/phone-form";
import { AddressList } from "@/components/addresses/address-list";
import { AddressForm } from "@/components/addresses/address-form";

export const Route = createFileRoute("/_auth/app/")({
  component: Dashboard,
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["profile"],
        queryFn: () => getMyProfile(),
      }),
      queryClient.prefetchQuery({
        queryKey: ["addresses"],
        queryFn: () => getMyAddresses(),
      }),
    ]);
  },
});

function Dashboard() {
  const { data: profile } = useSuspenseQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
  });

  const { data: addresses = [] } = useSuspenseQuery({
    queryKey: ["addresses"],
    queryFn: () => getMyAddresses(),
  });

  const hasAddress = addresses.length > 0;
  const hasPhone = !!profile.phone;
  const setupComplete = hasAddress && hasPhone;

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {!setupComplete && (
        <div className="mb-6 p-4 border rounded-lg bg-yellow-50">
          <h2 className="font-semibold mb-2">Setup Required</h2>
          <p className="text-sm text-gray-600 mb-2">
            To receive waste collection notifications, we need:
          </p>
          <ul className="text-sm space-y-1 ml-4">
            <li>{hasPhone ? "✓" : "○"} Phone number (for SMS delivery)</li>
            <li>{hasAddress ? "✓" : "○"} Address (to match waste schedule)</li>
          </ul>
        </div>
      )}

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <PhoneForm user={profile} />
        </TabsContent>

        <TabsContent value="addresses" className="space-y-4">
          <AddressList addresses={addresses} />
          {addresses.length === 0 && <AddressForm />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### 4.2 Phone Form Component
**File:** `apps/user-application/src/components/profile/phone-form.tsx` (new)

```tsx
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMyPhone } from "@/core/functions/profile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function PhoneForm({ user }) {
  const [phone, setPhone] = useState(user.phone || "");
  const [error, setError] = useState("");

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: updateMyPhone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const polishPhoneRegex = /^\+48 \d{3} \d{3} \d{3}$/;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!polishPhoneRegex.test(phone)) {
      setError("Invalid format. Use: +48 xxx xxx xxx");
      return;
    }

    setError("");
    mutation.mutate({ data: { phone } });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <Label>Phone Number</Label>
        <p className="text-sm text-gray-600 mb-2">
          Required for SMS notifications. Format: +48 xxx xxx xxx
        </p>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+48 123 456 789"
        />
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving..." : "Save Phone"}
      </Button>
    </form>
  );
}
```

### 4.3 Address List Component
**File:** `apps/user-application/src/components/addresses/address-list.tsx` (new)

```tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AddressList({ addresses }) {
  if (addresses.length === 0) {
    return (
      <div className="text-sm text-gray-600">
        No addresses yet. Add your first address below.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {addresses.map((addr) => (
        <div key={addr.id} className="p-4 border rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium">
                {addr.cityName}, {addr.streetName}
                {addr.isDefault && (
                  <Badge className="ml-2" variant="secondary">Default</Badge>
                )}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Notifications: 19:00 day before, 7:00 same day
              </div>
            </div>
            <div className="space-x-2">
              <Button variant="outline" size="sm">Edit</Button>
              <Button variant="outline" size="sm">Delete</Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 4.4 Address Form Component
**File:** `apps/user-application/src/components/addresses/address-form.tsx` (new)

```tsx
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createMyAddress } from "@/core/functions/addresses";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function AddressForm() {
  const [cityId, setCityId] = useState<number | null>(null);
  const [streetId, setStreetId] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const res = await fetch("/api/cities");
      return res.json();
    },
  });

  const { data: streets = [] } = useQuery({
    queryKey: ["streets", cityId],
    queryFn: async () => {
      if (!cityId) return [];
      const res = await fetch(`/api/cities/${cityId}/streets`);
      return res.json();
    },
    enabled: !!cityId,
  });

  useEffect(() => {
    setStreetId(null);
  }, [cityId]);

  const mutation = useMutation({
    mutationFn: createMyAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setCityId(null);
      setStreetId(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityId || !streetId) return;

    mutation.mutate({
      data: { cityId, streetId, isDefault: true }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <Label>City</Label>
        <p className="text-sm text-gray-600 mb-2">
          Select your city to see waste collection schedules
        </p>
        <Select
          value={cityId?.toString()}
          onValueChange={(val) => setCityId(Number(val))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select city" />
          </SelectTrigger>
          <SelectContent>
            {cities.map((city: { id: number; name: string }) => (
              <SelectItem key={city.id} value={city.id.toString()}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Street</Label>
        <Select
          value={streetId?.toString()}
          onValueChange={(val) => setStreetId(Number(val))}
          disabled={!cityId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select street" />
          </SelectTrigger>
          <SelectContent>
            {streets.map((street: { id: number; name: string }) => (
              <SelectItem key={street.id} value={street.id.toString()}>
                {street.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={!cityId || !streetId || mutation.isPending}>
        {mutation.isPending ? "Adding..." : "Add Address"}
      </Button>
    </form>
  );
}
```

---

## 5. Testing Flow

1. Generate + apply migration: `cd packages/data-ops && pnpm run drizzle:dev:generate && pnpm run drizzle:dev:migrate`
2. Rebuild data-ops: `pnpm run build:data-ops`
3. Start dev: `pnpm run dev:user-application`
4. Navigate to `/app` (auth required)
5. Add phone in Profile tab
6. Add address in Addresses tab → auto-creates notification prefs
7. Reload → verify data persisted
8. Check DB: addresses + notification_preferences tables populated

---

## 6. Critical Files

**Database:**
- `packages/data-ops/src/drizzle/auth-schema.ts` - Add phone field
- `packages/data-ops/src/drizzle/schema.ts` - Add addresses, notification_preferences tables
- `packages/data-ops/src/drizzle/relations.ts` - Table relations

**Data Layer:**
- `packages/data-ops/src/zod-schema/phone.ts` - Phone validation
- `packages/data-ops/src/queries/user.ts` - Profile queries
- `packages/data-ops/src/queries/address.ts` - Address queries
- `packages/data-ops/src/queries/notification-preferences.ts` - Notification pref queries

**Backend:**
- `apps/user-application/src/core/functions/profile.ts` - Profile server functions
- `apps/user-application/src/core/functions/addresses.ts` - Address server functions
- `apps/user-application/src/core/functions/notification-preferences.ts` - Notification pref server functions
- `apps/user-application/src/routes/api/cities/index.tsx` - Cities API
- `apps/user-application/src/routes/api/cities/$cityId/streets.tsx` - Streets API

**Frontend:**
- `apps/user-application/src/routes/_auth/app/index.tsx` - Dashboard with tabs
- `apps/user-application/src/components/profile/phone-form.tsx` - Phone form
- `apps/user-application/src/components/addresses/address-list.tsx` - Address list
- `apps/user-application/src/components/addresses/address-form.tsx` - Address form

---

## 7. Execution Order

1. Update auth-schema.ts (add phone field)
2. Create addresses + notification_preferences tables in schema.ts
3. Add relations in relations.ts
4. Generate migration: `drizzle:dev:generate`
5. Apply migration: `drizzle:dev:migrate`
6. Create Zod phone validation schema
7. Create queries: user.ts, address.ts, notification-preferences.ts
8. Build data-ops: `build:data-ops`
9. Create server functions: profile.ts, addresses.ts, notification-preferences.ts
10. Create API routes: cities endpoints
11. Create components: phone-form.tsx, address-list.tsx, address-form.tsx
12. Update dashboard route with tabs
13. Test end-to-end

---

## 8. Decisions

1. Phone field on auth_user (not separate table)
2. addresses table for many-to-many user-address relation
3. notification_preferences table for customizable notification times
4. Auto-create default notification prefs (19:00, 7:00) when address created
5. MVP: 1 address per user (DB supports many)
6. Phone validation: both client-side + server-side
7. Cascading dropdowns for city/street selection
8. Setup required banner until phone + address added
