# Design Doc: Database Seeder

## Overview

Import initial city/street data from JSON files (`.data-to-import/{year}/`) into Neon Postgres. Seeding functionality integrated into data-ops package for one-time/periodic seeding across dev/stage/prod.

## Goals

- Parse JSON files → insert cities + streets with proper foreign keys
- Handle all 3 envs (dev/stage/prod) via dotenvx
- Idempotent: safe to re-run without duplicates
- Progress logging + error handling

## Non-Goals

- CLI arguments (year hardcoded to 2025)
- Dry-run mode (direct DB writes only)
- Real-time sync (one-off bulk import only)
- Data validation beyond basic structure checks
- Migration generation (uses existing schema)

## Architecture

### Package Structure

```
packages/data-ops/
├── src/
│   ├── database/
│   │   ├── setup.ts          # Existing DB setup
│   │   └── seed/
│   │       ├── index.ts      # CLI entry (hardcoded 2025)
│   │       ├── importer.ts   # Core import logic
│   │       └── file-loader.ts # JSON file discovery + parsing
│   └── drizzle/
│       └── schema.ts         # Existing schema
├── .env.dev                  # Existing env files (DATABASE_*)
├── .env.stage
├── .env.prod
├── package.json              # Add seed scripts
└── tsconfig.json
```

**Integration:**
- Seeding logic lives in data-ops package (already has DB access, schemas, env setup)
- Root `package.json` adds convenience scripts
- Reuses existing dependencies (no new deps needed)

## CLI Interface

### Root package.json scripts

```json
{
  "seed:dev": "pnpm run --filter data-ops seed:dev",
  "seed:stage": "pnpm run --filter data-ops seed:stage",
  "seed:prod": "pnpm run --filter data-ops seed:prod"
}
```

### data-ops package.json scripts

```json
{
  "seed:dev": "dotenvx run -f .env.dev -- tsx src/database/seed/index.ts",
  "seed:stage": "dotenvx run -f .env.stage -- tsx src/database/seed/index.ts",
  "seed:prod": "dotenvx run -f .env.prod -- tsx src/database/seed/index.ts"
}
```

### Usage examples

```bash
# Dev env (hardcoded to 2025)
pnpm run seed:dev

# Stage env
pnpm run seed:stage

# Prod env
pnpm run seed:prod
```

## Implementation Details

### 1. index.ts (CLI Entry)
**Location:** `packages/data-ops/src/database/seed/index.ts`

```typescript
import { importer } from './importer';

const year = '2025';
const dataDir = `../../.data-to-import/${year}`;

importer(dataDir)
  .then(() => {
    console.log('✓ Import complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('✗ Import failed:', err.message);
    process.exit(1);
  });
```

### 2. file-loader.ts (JSON Discovery)
**Location:** `packages/data-ops/src/database/seed/file-loader.ts`

```typescript
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
```

### 3. importer.ts (Core Logic)
**Location:** `packages/data-ops/src/database/seed/importer.ts`

```typescript
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
```

## Idempotency Strategy

**Approach:** Check-then-insert (not upsert)

**Data Model:** Shared cities/streets across years (Scenario A)
- Cities and streets tables have NO year column
- Same city/street used for 2025, 2026, etc.
- Importing 2026 data merges with existing 2025 cities/streets
- Avoids duplication, supports notifications across years

**Rationale:**
- Cities: Name uniqueness check (no duplicate cities)
- Streets: Composite check (name + cityId) - same street name can exist in different cities
- No `.onConflictDoNothing()` needed since we check first
- Preserves existing IDs (important for FK relationships)

**Tradeoffs:**
- 2 queries per record (SELECT + INSERT) vs 1 upsert query
- Acceptable for bulk import scenario (not high-frequency)
- Clearer error messages on conflicts

## Error Handling

1. **Missing directory/files:** Exit with clear message
2. **Invalid JSON structure:** Zod throws with field details
3. **DB connection failure:** Propagate error to CLI (exit 1)
4. **Missing env vars:** dotenvx validation before script runs
5. **Duplicate detection:** Log skip, continue (don't fail)

## Environment Files

Uses existing `.env.{env}` files in `packages/data-ops/`:

```bash
DATABASE_HOST=ep-example.neon.tech/neondb?sslmode=require
DATABASE_USERNAME=neondb_owner
DATABASE_PASSWORD=your_password
```

**No setup needed** - seed scripts reuse existing data-ops env files

## Logging Output

```
Loading data from ../../.data-to-import/2025...
  + City: Stanisławów Pierwszy
    44 streets for Stanisławów Pierwszy
  + City: Nieporęt
    49 streets for Nieporęt

Summary: Inserted +2 cities, +93 streets
✓ Import complete
```

## Alternatives Considered

### 1. CLI arguments (--year, --dry-run)
**Rejected:** Overcomplicated for simple one-time seeding. Hardcoded year simpler. Parsing args with dotenvx wrapper caused issues.

### 2. Separate packages/db-feeder package
**Rejected:** Creates unnecessary workspace package. Seeding is database operation, belongs in data-ops. Would duplicate deps and env setup.

### 3. Drizzle Studio manual import
**Rejected:** Not scriptable, no env isolation, error-prone for bulk data

### 4. Place in apps/data-service
**Rejected:** Script is one-off admin task, not production runtime logic

### 5. SQL COPY command
**Rejected:** Requires pre-generated CSVs, loses TypeScript type safety

### 6. Use Drizzle's .onConflictDoNothing()
**Rejected:** Less control over logging, harder to track what was skipped vs inserted

## Security Considerations

- DB credentials via dotenvx (never committed)
- Read-only access to `.data-to-import/` (local filesystem)
- No user input (year hardcoded)
- Runs manually by admins (not exposed to end users)

## Performance Notes

- **Current scale:** ~200 cities, ~20K streets per year
- **Expected runtime:** 30-60 seconds for full import
- **Optimization opportunity:** Batch inserts for streets (future if needed)
- **Index usage:** Existing `streets_city_id_idx` helps FK lookups

## Setup Steps

1. Create seed directory: `mkdir -p packages/data-ops/src/database/seed`
2. Implement 3 files: index.ts, importer.ts, file-loader.ts
3. Add seed scripts to `packages/data-ops/package.json`
4. Add convenience scripts to root `package.json`
5. Add tsx to devDependencies: `pnpm add -D tsx`
6. First run: `pnpm run seed:dev`

## Resolved Design Decisions

- **Years:** Hardcoded to 2025 (change const in index.ts for other years)
- **Data strategy:** Merge (Scenario A - shared cities/streets across years)
- **CLI arguments:** Rejected - simpler without
- **Dry-run:** Rejected - direct DB writes only
- **Metadata tracking:** Not needed
