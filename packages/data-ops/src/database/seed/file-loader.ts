import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const ExtractionSchema = z.object({
  extraction: z.object({
    region: z.string(),
    addresses: z.array(z.object({
      city: z.string(),
      streets: z.array(z.string())
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
