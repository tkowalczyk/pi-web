import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { z } from 'zod';

const DataFileSchema = z.object({
  region: z.string(),
  addresses: z.array(z.object({
    city: z.string(),
    streets: z.array(z.string())
  })),
  wasteCollectionSchedule: z.record(
    z.string(), // month number as string ("1", "2", etc.)
    z.record(
      z.string(), // waste type key ("mixed", "metalsAndPlastics", etc.)
      z.array(z.number()) // array of days
    )
  ),
  wasteTypes: z.record(z.string(), z.string()) // waste type key -> display name
});

export type LoadedDataFile = {
  filename: string;
  year: number;
  month: number;
  data: z.infer<typeof DataFileSchema>;
};

export async function loadDataFiles(dir: string): Promise<LoadedDataFile[]> {
  const files = await readdir(dir);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  const data: LoadedDataFile[] = [];
  for (const file of jsonFiles) {
    const content = await readFile(join(dir, file), 'utf-8');
    const parsed = DataFileSchema.parse(JSON.parse(content));
    
    // Extract year and month from filename (e.g., "2026_1.json" -> year: 2026, month: 1)
    const filenameWithoutExt = basename(file, '.json');
    const parts = filenameWithoutExt.split('_');
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      throw new Error(`Invalid filename format: ${file}. Expected format: YYYY_M.json`);
    }
    const yearStr = parts[0];
    const monthStr = parts[1];
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    
    if (isNaN(year) || isNaN(month)) {
      throw new Error(`Invalid filename format: ${file}. Expected format: YYYY_M.json`);
    }
    
    data.push({
      filename: file,
      year,
      month,
      data: parsed
    });
  }

  return data;
}
