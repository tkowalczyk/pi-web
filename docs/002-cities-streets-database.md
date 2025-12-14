# Design Doc: Cities & Streets Database with Waste Collection Schedule

## Overview

Relational model for cities/streets/waste schedules. Import data from `sample_schedule.json`. Expose via API endpoints. Linked to addresses table (from doc 001) for user notifications.

## Architecture Flow

```
sample_schedule.json
  ↓ (seed script)
Database (regions, cities, streets, waste_types, waste_schedules tables)
  ↓ (queries)
API Endpoints (/api/cities, /api/cities/:id/streets, /api/cities/:id/schedule)
  ↓ (TanStack Query)
Address Form (cascading dropdowns)
  ↓ (references cities/streets)
addresses table (cityId/streetId FKs)
```

---

## 1. Database Schema

### 1.1 New Tables
**File:** `packages/data-ops/src/drizzle/schema.ts` (new file or add to existing)

```ts
import { pgTable, text, timestamp, integer, serial, index } from "drizzle-orm/pg-core";

export const regions = pgTable("regions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  regionId: integer("region_id").notNull().references(() => regions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("cities_region_id_idx").on(table.regionId),
]);

export const streets = pgTable("streets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("streets_city_id_idx").on(table.cityId),
]);

export const waste_types = pgTable("waste_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const waste_schedules = pgTable("waste_schedules", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: "cascade" }),
  wasteTypeId: integer("waste_type_id").notNull().references(() => waste_types.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  days: text("days").notNull(), // JSON array: "[13,27]"
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("waste_schedules_city_id_idx").on(table.cityId),
  index("waste_schedules_waste_type_id_idx").on(table.wasteTypeId),
]);
```

### 1.2 Relations
**File:** `packages/data-ops/src/drizzle/relations.ts` (add to existing from doc 001)

```ts
import { relations } from "drizzle-orm/relations";
import { regions, cities, streets, waste_types, waste_schedules } from "./schema";

export const regionsRelations = relations(regions, ({ many }) => ({
  cities: many(cities),
}));

export const citiesRelations = relations(cities, ({ one, many }) => ({
  region: one(regions, {
    fields: [cities.regionId],
    references: [regions.id],
  }),
  streets: many(streets),
  waste_schedules: many(waste_schedules),
  addresses: many(addresses), // from doc 001
}));

export const streetsRelations = relations(streets, ({ one, many }) => ({
  city: one(cities, {
    fields: [streets.cityId],
    references: [cities.id],
  }),
  addresses: many(addresses), // from doc 001
}));

export const wasteTypesRelations = relations(waste_types, ({ many }) => ({
  schedules: many(waste_schedules),
}));

export const wasteSchedulesRelations = relations(waste_schedules, ({ one }) => ({
  city: one(cities, {
    fields: [waste_schedules.cityId],
    references: [cities.id],
  }),
  wasteType: one(waste_types, {
    fields: [waste_schedules.wasteTypeId],
    references: [waste_types.id],
  }),
}));
```

### 1.3 Migration
```bash
cd packages/data-ops
pnpm run drizzle:dev:generate
pnpm run drizzle:dev:migrate
```

Creates migration with:
- CREATE TABLE regions, cities, streets, waste_types, waste_schedules
- CREATE INDEX on all FKs

---

## 2. Seed Script

**File:** `packages/data-ops/src/scripts/seed-waste-data.ts` (new)

```ts
import { getDb } from "@/database/setup";
import { regions, cities, streets, waste_types, waste_schedules } from "@/drizzle/schema";
import * as fs from "fs";
import * as path from "path";

interface ScheduleData {
  extraction: {
    region: string;
    addresses: Array<{
      city: string;
      streets: string[];
    }>;
    waste_collection_schedule: Array<{
      waste_type: string;
      days_of_the_month: Array<{
        month: string;
        days: number[];
      }>;
    }>;
  };
}

async function seedWasteData() {
  const db = getDb();

  const jsonPath = path.join(__dirname, "../../../.notes/sample_schedule.json");
  const data: ScheduleData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  // Insert region
  const [region] = await db.insert(regions)
    .values({ name: data.extraction.region })
    .returning();

  // Insert cities and streets
  const cityMap = new Map<string, number>();

  for (const addr of data.extraction.addresses) {
    const [city] = await db.insert(cities)
      .values({ name: addr.city, regionId: region.id })
      .returning();

    cityMap.set(addr.city, city.id);

    const streetValues = addr.streets.map(s => ({
      name: s,
      cityId: city.id,
    }));

    await db.insert(streets).values(streetValues);
  }

  // Insert waste types
  const wasteTypeMap = new Map<string, number>();

  for (const schedule of data.extraction.waste_collection_schedule) {
    const [wasteType] = await db.insert(waste_types)
      .values({ name: schedule.waste_type })
      .returning();

    wasteTypeMap.set(schedule.waste_type, wasteType.id);
  }

  // Insert waste schedules for all cities
  for (const [cityName, cityId] of cityMap.entries()) {
    for (const schedule of data.extraction.waste_collection_schedule) {
      const wasteTypeId = wasteTypeMap.get(schedule.waste_type)!;

      const scheduleValues = schedule.days_of_the_month.map(entry => ({
        cityId,
        wasteTypeId,
        month: entry.month,
        days: JSON.stringify(entry.days),
      }));

      await db.insert(waste_schedules).values(scheduleValues);
    }
  }

  console.log("Seeding complete!");
}

seedWasteData().catch(console.error);
```

**Add to package.json:**
```json
"seed:dev": "dotenvx run -f .env.dev -- tsx src/scripts/seed-waste-data.ts"
```

**Run:**
```bash
cd packages/data-ops
pnpm run seed:dev
```

---

## 3. Queries

### 3.1 Waste Schedule Queries
**File:** `packages/data-ops/src/queries/waste.ts` (new)

```ts
import { getDb } from "@/database/setup";
import { waste_schedules, waste_types } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getWasteScheduleByCityId(cityId: number) {
  const db = getDb();
  return await db.select({
    id: waste_schedules.id,
    wasteTypeName: waste_types.name,
    month: waste_schedules.month,
    days: waste_schedules.days,
  })
  .from(waste_schedules)
  .leftJoin(waste_types, eq(waste_schedules.wasteTypeId, waste_types.id))
  .where(eq(waste_schedules.cityId, cityId));
}
```

### 3.2 Rebuild data-ops
```bash
pnpm run build:data-ops
```

---

## 4. API Endpoints

### 4.1 Waste Schedule Endpoint
**File:** `apps/user-application/src/routes/api/cities/$cityId/schedule.tsx` (new)

```tsx
import { createAPIFileRoute } from "@tanstack/start/api";
import { getWasteScheduleByCityId } from "data-ops/queries/waste";

export const Route = createAPIFileRoute("/api/cities/$cityId/schedule")({
  GET: async ({ params }) => {
    const schedule = await getWasteScheduleByCityId(Number(params.cityId));
    return Response.json(schedule);
  },
});
```

**Note:** Cities and streets endpoints already created in doc 001.

---

## 5. Testing Flow

1. Migrate DB: `cd packages/data-ops && pnpm run drizzle:dev:generate && pnpm run drizzle:dev:migrate`
2. Seed data: `pnpm run seed:dev`
3. Rebuild data-ops: `pnpm run build:data-ops`
4. Test API endpoints:
   - `/api/cities` - list all cities
   - `/api/cities/1/streets` - streets for city 1
   - `/api/cities/1/schedule` - waste schedule for city 1

---

## 6. Critical Files

**Database:**
- `packages/data-ops/src/drizzle/schema.ts` - 5 new tables
- `packages/data-ops/src/drizzle/relations.ts` - Table relations

**Data Layer:**
- `packages/data-ops/src/scripts/seed-waste-data.ts` - Seed script
- `packages/data-ops/src/queries/waste.ts` - Waste schedule queries

**API:**
- `apps/user-application/src/routes/api/cities/$cityId/schedule.tsx` - Schedule endpoint

---

## 7. Execution Order

1. Create schema.ts with 5 new tables
2. Create relations.ts
3. Generate migration: `drizzle:dev:generate`
4. Apply migration: `drizzle:dev:migrate`
5. Create seed script: seed-waste-data.ts
6. Run seed: `seed:dev`
7. Create queries: waste.ts
8. Build data-ops: `build:data-ops`
9. Create API route: schedule endpoint
10. Test end-to-end

---

## 8. Decisions

1. Use serial IDs for all tables (not UUIDs)
2. Store waste schedule days as JSON text (not separate rows per day)
3. Seed script manual command (not auto-run post-migration)
4. API routes use TanStack Start API pattern
5. Cities/streets linked to addresses table (from doc 001) via FK
