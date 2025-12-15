import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const ExtractionSchema = z.object({
  extraction: z.object({
    region: z.string(),
    addresses: z.array(z.object({
      city: z.string(),
      streets: z.array(z.string())
    })),
    waste_collection_schedule: z.array(z.object({
      waste_type: z.string(),
      days_of_the_month: z.array(z.object({
        month: z.string(),
        days: z.array(z.number())
      }))
    }))
  })
});

export async function loadDataFiles(dir: string) {
  const files = await readdir(dir);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  const data = [];
  for (const file of jsonFiles) {
    const content = await readFile(join(dir, file), 'utf-8');
    const parsed = ExtractionSchema.parse(JSON.parse(content));
    data.push(parsed.extraction);
  }

  return data;
}
