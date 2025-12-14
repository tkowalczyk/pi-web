# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Setup
- `pnpm run setup` - Install deps + build data-ops (required first step)
- `pnpm run build:data-ops` - Rebuild data-ops after schema changes

### Development
- `pnpm run dev:user-application` - Run TanStack Start app (port 3000)
- `pnpm run dev:data-service` - Run Hono Worker service

### Deployment
- `pnpm run deploy:stage:user-application` - Deploy user app to stage
- `pnpm run deploy:prod:user-application` - Deploy user app to prod
- `pnpm run deploy:stage:data-service` - Deploy data service to stage
- `pnpm run deploy:prod:data-service` - Deploy data service to prod

### Database (in packages/data-ops/)
- `pnpm run drizzle:{env}:generate` - Generate migration for env (dev/stage/prod)
- `pnpm run drizzle:{env}:migrate` - Apply migration to env database
- `pnpm run drizzle:{env}:pull` - Pull schema from env database
- `pnpm run better-auth:generate` - Regen Better Auth schema

Replace `{env}` with `dev`, `stage`, or `prod`.

## Architecture

Pnpm monorepo with shared packages across multiple apps deploying to Cloudflare Workers.

### Core Structure
- `apps/user-application/` - TanStack Start frontend (React 19, TanStack Router/Query, Tailwind v4)
- `apps/data-service/` - Hono backend for long-running tasks (Cloudflare Worker entrypoint)
- `packages/data-ops/` - Shared package: Drizzle schemas, DB clients, queries, auth config

### Key Patterns

**data-ops package** - Central source of truth for:
- Drizzle schemas (`src/drizzle/`)
- DB setup (`src/database/setup.ts`)
- Queries (`src/queries/`)
- Auth config (`src/auth/`)
- Zod schemas (`src/zod-schema/`)

**Environment isolation** - Migrations tracked separately per env in `packages/data-ops/src/drizzle/migrations/{dev|stage|prod}/`

**Build dependency** - data-ops must build before apps can run (exports to `dist/`)

**Auth** - Better Auth + Polar.sh integration. Schema auto-generated from `config/auth.ts`.

**Database** - Neon Postgres via Drizzle ORM. Uses @neondatabase/serverless driver.

**Deployment** - Both apps deploy to Cloudflare Workers. Config in `wrangler.jsonc` per app. Envs managed via wrangler --env flag.

**Data service** - Uses WorkerEntrypoint pattern. Main router in `src/hono/app.ts`.

**User application** - File-based routing in `src/routes/`. See apps/user-application/CLAUDE.md for TanStack Start specifics.

### Development Flow
1. Make schema changes in `packages/data-ops/src/drizzle/`
2. Generate migration: `cd packages/data-ops && pnpm run drizzle:dev:generate`
3. Apply migration: `pnpm run drizzle:dev:migrate`
4. Rebuild data-ops: `pnpm run build:data-ops` (or from root)
5. Apps auto-reload with new schema
