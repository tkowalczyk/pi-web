#!/usr/bin/env tsx

import { join } from 'node:path';
import { initDatabase } from './setup';
import { cities, streets, waste_schedules, waste_types, addresses, notification_preferences, notification_logs } from '../drizzle/schema';
import { sql } from 'drizzle-orm';
import { importer } from './seed/importer';

async function clearAndImport() {
  console.log('Initializing database connection...');

  const db = initDatabase({
    host: process.env.DATABASE_HOST!,
    username: process.env.DATABASE_USERNAME!,
    password: process.env.DATABASE_PASSWORD!
  });

  console.log('\n🗑️  Clearing all data...\n');

  // Delete in correct order (respect foreign keys)
  console.log('  - Deleting notification_logs...');
  await db.delete(notification_logs);

  console.log('  - Deleting notification_preferences...');
  await db.delete(notification_preferences);

  console.log('  - Deleting addresses...');
  await db.delete(addresses);

  console.log('  - Deleting waste_schedules...');
  await db.delete(waste_schedules);

  console.log('  - Deleting streets...');
  await db.delete(streets);

  console.log('  - Deleting cities...');
  await db.delete(cities);

  console.log('  - Deleting waste_types...');
  await db.delete(waste_types);

  console.log('\n✅ All data cleared!\n');

  // Import data
  console.log('📥 Importing data from .data-to-import/raw/...\n');

  const dataDir = join(process.cwd(), '../../.data-to-import/raw');
  await importer(dataDir);

  console.log('\n✅ Import complete!\n');

  // Show summary
  const [citiesCount] = await db.select({ count: sql<number>`count(*)` }).from(cities);
  const [streetsCount] = await db.select({ count: sql<number>`count(*)` }).from(streets);
  const [schedulesCount] = await db.select({ count: sql<number>`count(*)` }).from(waste_schedules);
  const [typesCount] = await db.select({ count: sql<number>`count(*)` }).from(waste_types);

  console.log('Final counts:');
  console.log(`  Cities: ${citiesCount?.count ?? 0}`);
  console.log(`  Streets: ${streetsCount?.count ?? 0}`);
  console.log(`  Waste types: ${typesCount?.count ?? 0}`);
  console.log(`  Waste schedules: ${schedulesCount?.count ?? 0}`);

  process.exit(0);
}

clearAndImport().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
