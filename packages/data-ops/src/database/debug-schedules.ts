import { initDatabase, getDb } from "./setup";
import { waste_schedules, waste_types, cities, streets } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

async function main() {
  const cityId = parseInt(process.argv[2] || "0");
  const streetId = parseInt(process.argv[3] || "0");

  if (!cityId || !streetId) {
    console.error("Usage: pnpm debug:schedules:dev <cityId> <streetId>");
    process.exit(1);
  }

  initDatabase({
    host: process.env.DATABASE_HOST!,
    username: process.env.DATABASE_USERNAME!,
    password: process.env.DATABASE_PASSWORD!,
  });

  const db = getDb();

  const [city] = await db.select().from(cities).where(eq(cities.id, cityId));
  const [street] = await db.select().from(streets).where(eq(streets.id, streetId));

  console.log(`\nCity: ${city?.name || "NOT FOUND"} (id=${cityId})`);
  console.log(`Street: ${street?.name || "NOT FOUND"} (id=${streetId})\n`);

  const schedules = await db
    .select({
      id: waste_schedules.id,
      cityId: waste_schedules.cityId,
      streetId: waste_schedules.streetId,
      wasteTypeId: waste_schedules.wasteTypeId,
      wasteTypeName: waste_types.name,
      month: waste_schedules.month,
      days: waste_schedules.days,
    })
    .from(waste_schedules)
    .leftJoin(waste_types, eq(waste_schedules.wasteTypeId, waste_types.id))
    .where(
      and(
        eq(waste_schedules.cityId, cityId),
        eq(waste_schedules.streetId, streetId)
      )
    );

  if (schedules.length === 0) {
    console.log("NO SCHEDULES FOUND for this city+street combo!\n");

    const citySchedules = await db
      .select({ streetId: waste_schedules.streetId })
      .from(waste_schedules)
      .where(eq(waste_schedules.cityId, cityId))
      .groupBy(waste_schedules.streetId);

    console.log(`City ${cityId} has schedules for ${citySchedules.length} streets`);
    if (citySchedules.length > 0 && citySchedules.length <= 10) {
      console.log(`Street IDs with schedules: ${citySchedules.map(s => s.streetId).join(", ")}`);
    }
    return;
  }

  console.log(`Found ${schedules.length} schedule entries:\n`);

  for (const s of schedules) {
    const days = s.days ? JSON.parse(s.days) : [];
    console.log(`  ${s.wasteTypeName} (${s.month}): days ${days.join(", ")}`);
  }

  const now = new Date();
  const currentMonth = String(now.getMonth() + 1);
  const today = now.getDate();
  const tomorrow = today + 1;

  console.log(`\n--- Month ${currentMonth} check (today=${today}, tomorrow=${tomorrow}) ---`);
  const monthSchedules = schedules.filter(s => s.month === currentMonth);
  if (monthSchedules.length === 0) {
    console.log(`No schedules for month ${currentMonth}!`);
  } else {
    for (const s of monthSchedules) {
      const days = s.days ? JSON.parse(s.days) : [];
      console.log(`  ${s.wasteTypeName}: ${days.join(", ")}`);
      if (days.includes(today)) console.log("    ^ includes today");
      if (days.includes(tomorrow)) console.log("    ^ includes tomorrow");
    }
  }
}

main().catch(console.error);
