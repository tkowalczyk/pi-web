import { initDatabase } from '../setup';
import { cities, streets, waste_types, waste_schedules } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { loadDataFiles } from './file-loader';

export async function importer(dataDir: string) {
  console.log(`Loading data from ${dataDir}...`);
  const extractions = await loadDataFiles(dataDir);

  let cityCount = 0;
  let streetCount = 0;

  const db = initDatabase({
    host: process.env.DATABASE_HOST!,
    username: process.env.DATABASE_USERNAME!,
    password: process.env.DATABASE_PASSWORD!
  });

  for (const extraction of extractions) {
    for (const addr of extraction.addresses) {
      let cityRecord = await db
        .select()
        .from(cities)
        .where(eq(cities.name, addr.city))
        .limit(1)
        .then(rows => rows[0]);

      if (!cityRecord) {
        [cityRecord] = await db
          .insert(cities)
          .values({ name: addr.city })
          .returning();
        cityCount++;
        console.log(`  + City: ${addr.city}`);
      }

      for (const streetName of addr.streets) {
        const exists = await db
          .select()
          .from(streets)
          .where(and(
            eq(streets.name, streetName),
            eq(streets.cityId, cityRecord!.id)
          ))
          .limit(1)
          .then((rows: unknown[]) => rows.length > 0);

        if (!exists) {
          await db
            .insert(streets)
            .values({
              name: streetName,
              cityId: cityRecord!.id
            });
          streetCount++;
        }
      }
      console.log(`    ${addr.streets.length} streets for ${addr.city}`);
    }
  }

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

        if (typeRecord) {
          wasteTypeMap.set(typeName, typeRecord.id);
        }
      }
    }
  }

  // Import waste schedules
  let scheduleCount = 0;

  for (const extraction of extractions) {
    if (!extraction.addresses[0]) continue;

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

  console.log(`\nSummary: Inserted +${cityCount} cities, +${streetCount} streets, +${scheduleCount} schedules`);
}
