import { initDatabase } from '../setup';
import { cities, streets } from '../../drizzle/schema';
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

  console.log(`\nSummary: Inserted +${cityCount} cities, +${streetCount} streets`);
}
