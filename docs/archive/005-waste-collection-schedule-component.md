# Design Doc: Waste Collection Schedule Component

## Overview

Display component on authenticated dashboard showing next 2 weeks of waste collection for user's notification address. Shows waste type, collection dates, and days remaining. Integrates with existing dashboard Card layout.

## Goals

- Display upcoming waste collection (next 14 days) for user's notification address
- Clear, scannable calendar-like UI showing waste types as horizontal pills
- Highlight collections scheduled for today
- Match existing dashboard design patterns (Card, Badge, icons)
- Fetch schedule data via TanStack Query (SSR prefetch in loader)

## Non-Goals

- Historical waste collection data
- Calendar integration/export
- Schedule customization/editing
- Push notifications (separate feature)
- Multi-year support (2025 only)
- "Mark as collected" interaction
- Filter by waste type dropdown
- Display city name (shown above in address section)

## Context & Background

Current state:
- Users can save addresses (city + street) in dashboard
- Notification preferences reference specific addressId in `notification_preferences` table
- Cities/streets in DB with FKs to addresses table
- Waste collection schedules stored in JSON files (`.data-to-import/2025/*.json`)
- Notification system exists but no UI shows upcoming collections

Missing pieces:
- No `waste_types` or `waste_schedules` tables in schema
- No queries to fetch collection schedules for notification address
- No API endpoint for schedule data
- No component to display schedules

## Architecture Flow

```
User's notification preferences → addressId
  ↓
Get address → cityId
  ↓
Fetch waste schedules for cityId (via TanStack Query)
  ↓
Filter schedules → next 14 days from today
  ↓
Group by date, show waste types as horizontal pills
  ↓
Render WasteScheduleCard component on dashboard
```

---

## 1. Database Schema Changes

### 1.1 New Tables

**File:** `packages/data-ops/src/drizzle/schema.ts`

Add 2 new tables after existing `notification_preferences`:

```typescript
export const waste_types = pgTable("waste_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const waste_schedules = pgTable("waste_schedules", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: "cascade" }),
  wasteTypeId: integer("waste_type_id").notNull().references(() => waste_types.id, { onDelete: "cascade" }),
  year: integer("year").notNull(), // 2025
  month: text("month").notNull(), // "January"
  days: text("days").notNull(), // JSON: "[13,27]"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("waste_schedules_city_id_idx").on(table.cityId),
  index("waste_schedules_waste_type_id_idx").on(table.wasteTypeId),
  index("waste_schedules_year_idx").on(table.year),
]);
```

**Rationale:**
- `waste_types`: Normalized table (typical types: "Zmieszane", "Segregowane", "Bio")
- `waste_schedules`: Per-city, per-type, per-month schedule
- `days` as JSON text: Efficient storage, matches source JSON structure
- `year` column: Support future years (2026+) without schema changes

### 1.2 Relations

**File:** `packages/data-ops/src/drizzle/relations.ts` (add to existing)

```typescript
import { waste_types, waste_schedules } from "./schema";

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

// Update citiesRelations to include schedules
export const citiesRelations = relations(cities, ({ many }) => ({
  streets: many(streets),
  addresses: many(addresses),
  wasteSchedules: many(waste_schedules), // ADD THIS
}));
```

### 1.3 Migration

```bash
cd packages/data-ops
pnpm run drizzle:dev:generate
pnpm run drizzle:dev:migrate
pnpm run build:data-ops
```

---

## 2. Data Import (Extend Existing Seeder)

### 2.1 Update Seeder to Import Waste Schedules

**File:** `packages/data-ops/src/database/seed/importer.ts` (modify existing)

Add waste schedule import logic after existing city/street import:

```typescript
import { waste_types, waste_schedules } from '../../drizzle/schema';

// Inside importer() function, after street import:

// Import waste types
const wasteTypeMap = new Map<string, number>();

for (const extraction of extractions) {
  for (const schedule of extraction.waste_collection_schedule) {
    const typeName = schedule.waste_type;

    if (!wasteTypeMap.has(typeName)) {
      let typeRecord = await db
        .select()
        .from(waste_types)
        .where(eq(waste_types.name, typeName))
        .limit(1)
        .then(rows => rows[0]);

      if (!typeRecord) {
        [typeRecord] = await db
          .insert(waste_types)
          .values({ name: typeName })
          .returning();
        console.log(`  + Waste type: ${typeName}`);
      }

      wasteTypeMap.set(typeName, typeRecord.id);
    }
  }
}

// Import waste schedules
let scheduleCount = 0;

for (const extraction of extractions) {
  // Get cityId from previously imported city
  const cityRecord = await db
    .select()
    .from(cities)
    .where(eq(cities.name, extraction.addresses[0].city))
    .limit(1)
    .then(rows => rows[0]);

  if (!cityRecord) continue;

  for (const schedule of extraction.waste_collection_schedule) {
    const wasteTypeId = wasteTypeMap.get(schedule.waste_type)!;

    for (const entry of schedule.days_of_the_month) {
      const exists = await db
        .select()
        .from(waste_schedules)
        .where(and(
          eq(waste_schedules.cityId, cityRecord.id),
          eq(waste_schedules.wasteTypeId, wasteTypeId),
          eq(waste_schedules.year, 2025),
          eq(waste_schedules.month, entry.month)
        ))
        .limit(1)
        .then(rows => rows.length > 0);

      if (!exists) {
        await db
          .insert(waste_schedules)
          .values({
            cityId: cityRecord.id,
            wasteTypeId,
            year: 2025,
            month: entry.month,
            days: JSON.stringify(entry.days),
          });
        scheduleCount++;
      }
    }
  }
}

console.log(`Summary: Inserted +${cityCount} cities, +${streetCount} streets, +${scheduleCount} schedules`);
```

**Run seeder:**
```bash
pnpm run seed:dev
```

---

## 3. Queries

### 3.1 Waste Schedule Query

**File:** `packages/data-ops/src/queries/waste.ts` (new)

```typescript
import { getDb } from "@/database/setup";
import { waste_schedules, waste_types, addresses, notification_preferences } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getWasteScheduleByUserId(userId: string) {
  const db = getDb();

  // Get notification address
  const notifPref = await db
    .select({ addressId: notification_preferences.addressId })
    .from(notification_preferences)
    .where(eq(notification_preferences.userId, userId))
    .limit(1)
    .then(rows => rows[0]);

  if (!notifPref) return [];

  // Get cityId from address
  const address = await db
    .select({ cityId: addresses.cityId })
    .from(addresses)
    .where(eq(addresses.id, notifPref.addressId))
    .limit(1)
    .then(rows => rows[0]);

  if (!address) return [];

  // Get waste schedules for city
  return await db
    .select({
      id: waste_schedules.id,
      wasteTypeName: waste_types.name,
      wasteTypeId: waste_schedules.wasteTypeId,
      year: waste_schedules.year,
      month: waste_schedules.month,
      days: waste_schedules.days,
    })
    .from(waste_schedules)
    .leftJoin(waste_types, eq(waste_schedules.wasteTypeId, waste_types.id))
    .where(eq(waste_schedules.cityId, address.cityId));
}
```

### 3.2 Rebuild data-ops

```bash
pnpm run build:data-ops
```

---

## 4. Server Functions

### 4.1 Waste Schedule Function

**File:** `apps/user-application/src/core/functions/waste.ts` (new)

```typescript
import { createServerFn } from "@tanstack/react-start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import { getWasteScheduleByUserId } from "@repo/data-ops/queries/waste";

const baseFunction = createServerFn().middleware([protectedFunctionMiddleware]);

export const getMyWasteSchedule = baseFunction.handler(async (ctx) => {
  return getWasteScheduleByUserId(ctx.context.session.user.id);
});
```

---

## 5. UI Component

### 5.1 Waste Schedule Card Component

**File:** `apps/user-application/src/components/dashboard/waste-schedule-card.tsx` (new)

```typescript
import { useSuspenseQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Calendar } from "lucide-react";
import { getMyWasteSchedule } from "@/core/functions/waste";

export function WasteScheduleCard() {
  const { data: schedules = [] } = useSuspenseQuery({
    queryKey: ["waste-schedule"],
    queryFn: () => getMyWasteSchedule(),
  });

  const upcomingCollections = getUpcomingCollections(schedules);

  if (upcomingCollections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="outline">Schedule</Badge>
          </div>
          <CardTitle>Waste Collection</CardTitle>
          <CardDescription>
            No upcoming collections in next 2 weeks
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="group hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Trash2 className="h-5 w-5 text-primary" />
          </div>
          <Badge variant="outline">Next 2 Weeks</Badge>
        </div>
        <CardTitle>Waste Collection</CardTitle>
        <CardDescription>
          Upcoming collections for notification address
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {upcomingCollections.map((collection, idx) => {
            const isToday = collection.daysUntil === 0;

            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                  isToday
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-muted/50 hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground mb-1">
                      {collection.dateFormatted}
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                      {collection.wasteTypes.map((type, typeIdx) => (
                        <Badge
                          key={typeIdx}
                          variant={isToday ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Badge variant={isToday ? "default" : "outline"}>
                  {isToday
                    ? "Today"
                    : collection.daysUntil === 1
                    ? "Tomorrow"
                    : `${collection.daysUntil}d`}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper functions
interface UpcomingCollection {
  wasteTypes: string[];
  date: Date;
  dateFormatted: string;
  daysUntil: number;
}

function getUpcomingCollections(schedules: any[]): UpcomingCollection[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoWeeksFromNow = new Date(today);
  twoWeeksFromNow.setDate(today.getDate() + 14);

  // Map: date string -> waste types array
  const collectionMap = new Map<string, { date: Date; wasteTypes: string[] }>();

  for (const schedule of schedules) {
    const days = JSON.parse(schedule.days) as number[];
    const monthIndex = monthNameToIndex(schedule.month);

    for (const day of days) {
      const date = new Date(schedule.year, monthIndex, day);
      date.setHours(0, 0, 0, 0);

      if (date >= today && date <= twoWeeksFromNow) {
        const dateKey = date.toISOString().split('T')[0];

        if (!collectionMap.has(dateKey)) {
          collectionMap.set(dateKey, { date, wasteTypes: [] });
        }

        collectionMap.get(dateKey)!.wasteTypes.push(schedule.wasteTypeName || "Unknown");
      }
    }
  }

  const collections: UpcomingCollection[] = Array.from(collectionMap.values()).map(item => {
    const daysUntil = Math.floor((item.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      wasteTypes: item.wasteTypes,
      date: item.date,
      dateFormatted: formatDate(item.date),
      daysUntil,
    };
  });

  return collections.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function monthNameToIndex(month: string): number {
  const months = ["January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"];
  return months.indexOf(month);
}

function formatDate(date: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}
```

### 5.2 Integrate into Dashboard

**File:** `apps/user-application/src/routes/_auth/app/index.tsx` (modify existing)

Add to imports:
```typescript
import { WasteScheduleCard } from "@/components/dashboard/waste-schedule-card";
import { getMyWasteSchedule } from "@/core/functions/waste";
```

Add to loader (after existing prefetch):
```typescript
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
    queryClient.prefetchQuery({
      queryKey: ["waste-schedule"],
      queryFn: () => getMyWasteSchedule(),
    }),
  ]);
},
```

Add to JSX (after existing Profile/Addresses grid, before Notification Info Card):
```tsx
{/* Waste Collection Schedule */}
{setupComplete && (
  <div className="mt-8">
    <WasteScheduleCard />
  </div>
)}
```

---

## 6. Type Definitions

### 6.1 Zod Schema (optional, for type safety)

**File:** `packages/data-ops/src/zod-schema/waste.ts` (new)

```typescript
import { z } from "zod";

export const WasteScheduleResponseSchema = z.object({
  id: z.number(),
  wasteTypeName: z.string().nullable(),
  wasteTypeId: z.number(),
  year: z.number(),
  month: z.string(),
  days: z.string(), // JSON string
});

export type WasteScheduleResponse = z.infer<typeof WasteScheduleResponseSchema>;
```

---

## 7. Testing Flow

### 7.1 Database Setup
```bash
cd packages/data-ops
pnpm run drizzle:dev:generate
pnpm run drizzle:dev:migrate
pnpm run seed:dev  # imports waste schedules
pnpm run build:data-ops
```

### 7.2 Verify Data
```sql
-- Check waste types
SELECT * FROM waste_types;

-- Check schedules for city
SELECT ws.*, wt.name
FROM waste_schedules ws
JOIN waste_types wt ON ws.waste_type_id = wt.id
WHERE ws.city_id = 1
LIMIT 10;
```

### 7.3 Run App
```bash
cd ../../
pnpm run dev:user-application
```

Visit `http://localhost:3000/app` when logged in with address saved.

---

## 8. Edge Cases & Error Handling

1. **No notification preferences:** Query returns empty array, shows "No upcoming collections"
2. **No schedules in DB:** Shows "No upcoming collections" message
3. **No collections in next 14 days:** Shows "No upcoming collections" message
4. **Multiple waste types same day:** Displayed as horizontal pills
5. **Past dates in schedule:** Filtered out by date comparison (today = 00:00:00)
6. **Invalid JSON in days field:** Would throw error - seed validation ensures correctness
7. **Missing cityId:** Query returns empty array

---

## 9. Performance Considerations

### Query Optimization
- Indexed on `city_id`, `waste_type_id`, `year`
- Typical query: ~12 rows per city (1 waste type × 12 months)
- Prefetched in loader → SSR hydration, no loading spinner

### Client-Side Computation
- Date filtering happens client-side (avoids complex SQL date queries)
- ~12 schedule records × ~3 waste types = ~36 records max
- Negligible performance impact

### Caching
- TanStack Query cache: 5 min default staleTime
- Server-side prefetch: eliminates network waterfall

---

## 10. Future Enhancements (Out of Scope)

1. **Multi-address view:** Dropdown to switch between saved addresses
2. **Calendar export:** Download ICS file
3. **Reminders:** Toggle individual collection reminders
4. **Missed collection tracking:** Mark collection as missed, request pickup
5. **Waste sorting guide:** Modal showing what goes in each bin

---

## 11. Critical Files

**Database:**
- `packages/data-ops/src/drizzle/schema.ts` - Add 2 tables
- `packages/data-ops/src/drizzle/relations.ts` - Add relations

**Data Layer:**
- `packages/data-ops/src/database/seed/importer.ts` - Extend seeder
- `packages/data-ops/src/queries/waste.ts` - New query
- `packages/data-ops/src/zod-schema/waste.ts` - New types (optional)

**API:**
- `apps/user-application/src/core/functions/waste.ts` - Server function

**UI:**
- `apps/user-application/src/components/dashboard/waste-schedule-card.tsx` - New component
- `apps/user-application/src/routes/_auth/app/index.tsx` - Integrate component

---

## 12. Implementation Steps

1. **Schema changes** (15 min)
   - Add `waste_types` and `waste_schedules` to schema.ts
   - Add relations to relations.ts
   - Generate + apply migration

2. **Data import** (20 min)
   - Extend seeder in importer.ts
   - Run seed:dev
   - Verify data in Drizzle Studio / psql

3. **Queries** (10 min)
   - Create waste.ts query file
   - Add getWasteScheduleByCityId function
   - Rebuild data-ops

4. **Server function** (10 min)
   - Create waste.ts server function
   - Add getWasteScheduleForCity

5. **UI component** (30 min)
   - Create waste-schedule-card.tsx
   - Implement date filtering logic
   - Style with existing Card/Badge patterns

6. **Dashboard integration** (15 min)
   - Update loader with prefetch
   - Add component to JSX
   - Test with/without addresses

7. **Testing** (20 min)
   - Verify SSR prefetch
   - Test edge cases (no data, past dates)
   - Check responsive design
   - Confirm TanStack Query caching

**Total: ~2 hours**

---

## 13. Design Decisions

1. **Show notification address only:** Uses addressId from notification_preferences table. User has already set up notifications for specific address.

2. **Horizontal pills for waste types:** Multiple waste types on same day shown as pill badges. Cleaner than vertical list.

3. **Highlight today's collections:** Border + background color change + primary badge variant for visual prominence.

4. **14-day window:** Balances useful lookahead without overwhelming user. Matches typical waste collection frequency (weekly/biweekly).

5. **Client-side date filtering:** Simpler than SQL date logic, negligible perf impact for small dataset.

6. **Prefetch in loader:** Eliminates loading spinner, improves perceived performance.

7. **Group by date:** Calendar-like view. Waste types become attributes of collection date, not separate rows.

8. **JSON days storage:** Matches source data, efficient for read-heavy access pattern.

9. **Year column in schema:** Future-proofs for 2026+ data without schema changes.

10. **No city name display:** Notification address shown above in dashboard. Reduces redundancy.
