import { initDatabase } from '../setup';
import { cities, streets, waste_types, waste_schedules } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { loadDataFiles } from './file-loader';

export async function importer(dataDir: string) {
  console.log(`Loading data from ${dataDir}...`);
  const loadedFiles = await loadDataFiles(dataDir);

  let cityCount = 0;
  let streetCount = 0;

  const db = initDatabase({
    host: process.env.DATABASE_HOST!,
    username: process.env.DATABASE_USERNAME!,
    password: process.env.DATABASE_PASSWORD!
  });

  // First pass: Import all cities and streets from all files
  const processedCities = new Set<string>();
  
  for (const fileData of loadedFiles) {
    for (const addr of fileData.data.addresses) {
      // Get or create city record
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

      // Track if this is the first time we're processing streets for this city
      const isFirstTime = !processedCities.has(addr.city);
      processedCities.add(addr.city);

      // Always process streets, even if city was already seen (to import streets from later files)
      let newStreetsInThisFile = 0;
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
          newStreetsInThisFile++;
        }
      }
      
      // Log street information
      if (isFirstTime) {
        if (addr.streets.length > 0) {
          console.log(`    ${addr.streets.length} streets for ${addr.city}`);
        } else {
          console.log(`    (no streets listed for ${addr.city})`);
        }
      } else if (newStreetsInThisFile > 0) {
        // Log when additional streets are added from later files
        console.log(`    +${newStreetsInThisFile} additional streets for ${addr.city} (from ${fileData.filename})`);
      }
    }
  }

  // Import waste types from all files (using wasteTypes mapping)
  const wasteTypeMap = new Map<string, number>();

  for (const fileData of loadedFiles) {
    for (const [wasteTypeKey, wasteTypeName] of Object.entries(fileData.data.wasteTypes)) {
      if (!wasteTypeMap.has(wasteTypeKey)) {
        let typeRecord = await db
          .select()
          .from(waste_types)
          .where(eq(waste_types.name, wasteTypeName))
          .limit(1)
          .then(rows => rows[0]);

        if (!typeRecord) {
          [typeRecord] = await db
            .insert(waste_types)
            .values({ name: wasteTypeName })
            .returning();
          console.log(`  + Waste type: ${wasteTypeName}`);
        }

        if (typeRecord) {
          wasteTypeMap.set(wasteTypeKey, typeRecord.id);
        }
      }
    }
  }

  // Import waste schedules (street-level)
  let scheduleCount = 0;

  for (const fileData of loadedFiles) {
    const { data, year } = fileData;
    
    // Process each city in this file
    for (const addr of data.addresses) {
      const cityRecord = await db
        .select()
        .from(cities)
        .where(eq(cities.name, addr.city))
        .limit(1)
        .then(rows => rows[0]);

      if (!cityRecord) continue;

      // Get only streets defined in THIS file for this city
      let cityStreets: Array<{ id: number; name: string; cityId: number; createdAt: Date; updatedAt: Date }> = [];
      if (addr.streets.length === 0) {
        // If no streets listed, create/use city-wide street entry
        const cityWideStreetName = '---';
        const existingCityWide = await db
          .select()
          .from(streets)
          .where(and(
            eq(streets.name, cityWideStreetName),
            eq(streets.cityId, cityRecord.id)
          ))
          .limit(1)
          .then(rows => rows[0]);

        if (!existingCityWide) {
          const [cityWideStreet] = await db
            .insert(streets)
            .values({
              name: cityWideStreetName,
              cityId: cityRecord.id
            })
            .returning();
          if (cityWideStreet) {
            cityStreets = [cityWideStreet];
            streetCount++;
            console.log(`    Created city-wide street entry for ${cityRecord.name}`);
          }
        } else {
          cityStreets = [existingCityWide];
        }
      } else {
        // Get only the streets from THIS file
        for (const streetName of addr.streets) {
          const streetRecord = await db
            .select()
            .from(streets)
            .where(and(
              eq(streets.name, streetName),
              eq(streets.cityId, cityRecord.id)
            ))
            .limit(1)
            .then(rows => rows[0]);

          if (streetRecord) {
            cityStreets.push(streetRecord);
          }
        }
      }

      console.log(`  Processing ${fileData.filename}: ${cityStreets.length} street(s) in ${cityRecord.name}...`);

      // Process waste collection schedule for all months in this file
      for (const [monthStr, monthSchedule] of Object.entries(data.wasteCollectionSchedule)) {
        const monthNum = parseInt(monthStr, 10);
        if (isNaN(monthNum)) {
          console.warn(`    Warning: Invalid month key "${monthStr}" in ${fileData.filename}`);
          continue;
        }

        // For each waste type in the schedule
        for (const [wasteTypeKey, days] of Object.entries(monthSchedule)) {
          const wasteTypeId = wasteTypeMap.get(wasteTypeKey);
          if (!wasteTypeId) {
            console.warn(`    Warning: Unknown waste type key "${wasteTypeKey}" in ${fileData.filename}`);
            continue;
          }

          // Skip if no days
          if (!days || days.length === 0) continue;

          // Create schedule entry for EACH street in the city
          for (const street of cityStreets) {
            const exists = await db
              .select()
              .from(waste_schedules)
              .where(and(
                eq(waste_schedules.cityId, cityRecord.id),
                eq(waste_schedules.streetId, street.id),
                eq(waste_schedules.wasteTypeId, wasteTypeId),
                eq(waste_schedules.year, year),
                eq(waste_schedules.month, monthStr)
              ))
              .limit(1)
              .then(rows => rows.length > 0);

            if (!exists) {
              await db
                .insert(waste_schedules)
                .values({
                  cityId: cityRecord.id,
                  streetId: street.id,
                  wasteTypeId,
                  year,
                  month: monthStr,
                  days: JSON.stringify(days),
                });
              scheduleCount++;
            }
          }
        }
      }
    }
  }

  console.log(`\nSummary: Inserted +${cityCount} cities, +${streetCount} streets, +${scheduleCount} schedules`);
}
