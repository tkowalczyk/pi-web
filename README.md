# powiadomienia.info

Web application that sends SMS messages about upcoming waste collection dates.

## Architecture

Monorepo using [pnpm workspace](https://pnpm.io/workspaces) with modular packages shared across apps:
- [apps/user-application](./apps/user-application/) - TanStack Start consumer-facing app
- [apps/data-service](./apps/data-service/) - Backend service for long-running tasks
- [packages/data-ops](./packages/data-ops/) - Shared DB layer (schemas, queries, auth)

Stack: [Better Auth](https://www.better-auth.com/docs/introduction), [Drizzle ORM](https://orm.drizzle.team/docs/overview), [Cloudflare Workers](https://developers.cloudflare.com/workers/), Neon Postgres.

## data-ops Package

Central shared package for all database operations. Both apps consume this package for type-safe DB access.

**Purpose**: Single source of truth for database schemas, queries, validations, and auth config.

### Directory Structure

#### `src/drizzle/`
Core database definitions using Drizzle ORM.

- **`schema.ts`** - Main application tables (cities, streets, addresses, notification_preferences)
- **`auth-schema.ts`** - Better Auth tables (auto-generated, don't edit manually)
- **`relations.ts`** - Drizzle relational queries config (defines joins between tables)
- **`migrations/{env}/`** - Migration history per environment (dev/stage/prod)

#### `src/queries/`
Reusable database operations exported as functions.

Example: `user.ts` exports `getUserProfile()`, `updateUserPhone()`

**Usage**: Import and call from apps - handles DB connection internally via `getDb()`.

```ts
import { getUserProfile } from "data-ops/queries/user";
const user = await getUserProfile(userId);
```

#### `src/zod-schema/`
API request/response validation schemas using Zod.

**Purpose**: Type-safe contracts between frontend/backend. Validates data shape at runtime.

Example: `user.ts` exports `UserProfileResponse` schema.

#### `src/database/`
- **`setup.ts`** - DB client initialization (`getDb()` function)
- **`seed/`** - Data seeding utilities (file loader, importer)

#### `src/auth/`
Better Auth configuration.
- **`setup.ts`** - Auth config (providers, plugins)
- **`server.ts`** - Auth server instance

### Workflow for New DB Features

1. **Add table** to `src/drizzle/schema.ts`
2. **Add relations** to `src/drizzle/relations.ts` (if needed)
3. **Generate migration**: `pnpm run drizzle:dev:generate`
4. **Apply migration**: `pnpm run drizzle:dev:migrate`
5. **Create queries** in `src/queries/{feature}.ts`
6. **Create Zod schemas** in `src/zod-schema/{feature}.ts`
7. **Rebuild package**: `pnpm run build:data-ops`
8. **Import in apps**: Use queries/schemas from both user-application and data-service

## Setup

```bash
pnpm run setup
```

Installs all dependencies and builds data-ops package.

## Development

```bash
pnpm run dev:user-application  # TanStack Start app (port 3000)
pnpm run dev:data-service      # Hono backend service
```

### Database Migrations

From `packages/data-ops/` directory:

```bash
pnpm run drizzle:dev:generate  # Generate migration
pnpm run drizzle:dev:migrate   # Apply to database
```

Replace `dev` with `stage` or `prod`. Migrations stored in `src/drizzle/migrations/{env}/`.

### Environment Variables

Config files in `packages/data-ops/`:
- `.env.dev` - Local development
- `.env.stage` - Staging
- `.env.prod` - Production

Required:
```bash
DATABASE_HOST=
DATABASE_USERNAME=
DATABASE_PASSWORD=
```

## Deployment

### User Application

Once the deployment is done, Cloudflare will response with URL to view the deployment. If you want to change the name associated with Worker, do so by changing the `name` in the [wrangler.jsonc](./apps/user-application/wrangler.jsonc) file.

You can also use your own domain names associated with Cloudflare account by adding a route to this file as well.

#### Staging Environment

```bash
pnpm run deploy:stage:user-application
```

This will deploy the [user-application](./apps/user-application/) to Cloudflare Workers into staging environment.

#### Production Environment

```bash
pnpm run deploy:prod:user-application
```

This will deploy the [user-application](./apps/user-application/) to Cloudflare Workers into production environment.

### Data Service

Once the deployment is done, Cloudflare will response with URL to view the deployment. If you want to change the name associated with Worker, do so by changing the `name` in the [wrangler.jsonc](./apps/data-service/wrangler.jsonc) file.

You can also use your own domain names associated with Cloudflare account by adding a route to this file as well.

#### Staging Environment

```bash
pnpm run deploy:stage:data-service
```

#### Production Environment

```bash
pnpm run deploy:prod:data-service
```