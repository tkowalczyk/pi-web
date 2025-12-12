# saas-kit

## High Level Description

At a high level, this template provides basic authentication using [Better Auth](https://www.better-auth.com/docs/introduction), payments and subscriptions with [Polar.sh](https://polar.sh/docs/introduction), [Drizzle ORM](https://orm.drizzle.team/docs/overview) so you can bring whatever relational database you prefer, and it deploys out of the box to [Cloudflare Worker](https://developers.cloudflare.com/workers/), which can accommodate free hobby projects to serious high volume services. But most importantly, this template implements a project structure that can truly scale with complexity. It is designed as modular components that can be pieced together, so this template provides a monorepo setup using a [pnpm workspace](https://pnpm.io/workspaces). This allows to create lightweight packages of reusable code that can be shared across multiple apps.

An example of this can be found in a package called [data-ops](./packages/data-ops), which contains all the core logic for:
- managing Drizzle schemas, 
- creating database clients,
- defining database queries. 

The queries can then be used in a consumer-facing [TanStack Start](https://tanstack.com/start/latest/docs/framework/react/overview) app but can also be used in a separate back-end service that handles long-running tasks.

In the root directory, the number of files is pretty limited as this is a monorepo setup that contains multiple apps and packages:
- [apps/user-application](./apps/user-application/)
- [apps/data-service](./apps/data-service/)
- [packages/data-ops](./packages/data-ops/)

## Setup

```bash
pnpm run setup
```

This will install all the dependencies for all of the [packages](./packages/) and the [apps](./apps/). It will then build the package called data-ops which is used by our apps.

## Development

### User Application
```bash
pnpm run dev:user-application
```

Start up a TanStack Start app

### Data Service
```bash
pnpm run dev:data-service
```

### Data-Ops Package

#### Database

Using [Neon](https://neon.com/docs/introduction) as Postgres provider.

**Migrations** - isolated per env (dev/stage/prod):

In the [data-ops](./packages/data-ops/) directory:

```bash
# Generate migration
pnpm run drizzle:dev:generate

# Apply to database
pnpm run drizzle:dev:migrate
```

Replace `dev` with `stage` or `prod` for other envs. Each env maintains separate migration history in `src/drizzle/migrations/{env}/`.

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