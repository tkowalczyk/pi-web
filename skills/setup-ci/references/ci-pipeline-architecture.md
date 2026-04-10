# CI/CD Pipeline Architecture

Reference document for the `/setup-ci` skill. Describes the full pipeline that gets created.

## Pipeline overview

```
PR opened/updated
     │
     ├─► ci.yml
     │   ├── Job: Create Neon Branch (PRs only)
     │   │   └── neondatabase/create-branch-action@v6
     │   │       inputs: project_id, api_key
     │   │       outputs: db_url_with_pooler, branch_id
     │   │
     │   ├── Job: Lint + Test + Quality
     │   │   ├── pnpm install --frozen-lockfile
     │   │   ├── build shared packages (e.g. data-ops)
     │   │   ├── [HARD] biome ci .
     │   │   ├── [HARD] pnpm test
     │   │   │   env: TEST_DB_PROFILE=managed (PR) or local (push)
     │   │   │   env: TEST_DATABASE_URL=<neon branch url> (PR only)
     │   │   ├── [advisory] pnpm types
     │   │   ├── [advisory] pnpm knip
     │   │   └── [advisory] pnpm deps
     │   │
     │   └── Job: Delete Neon Branch (PRs only, always() runs)
     │       └── neondatabase/delete-branch-action@v3
     │
     ▼
Branch protection check: "Lint + Test + Quality" green?
     │
     ├── NO → merge blocked
     └── YES → merge allowed
              │
              ▼
         push to main
              │
              ├─► ci.yml (push trigger)
              │   └── Same jobs, but Neon branch skipped
              │       Tests run on local PGLite (fast, no network)
              │
              └─► deploy-stage.yml
                  ├── wrangler deploy --env stage (app 1)
                  └── wrangler deploy --env stage (app 2)
                  → stage.example.com updated

Manual trigger (Actions tab → "Deploy Production" → Run workflow)
     │
     └─► deploy-prod.yml
         │ environment: production (requires reviewer approval)
         ├── wrangler deploy --env prod (app 1)
         └── wrangler deploy --env prod (app 2)
         → example.com updated
```

## Neon branching model

```
Neon project "main" branch (source of truth)
     │
     ├── ci/pr-42  (ephemeral, created by CI, deleted on PR close)
     ├── ci/pr-43  (ephemeral, created by CI, deleted on PR close)
     └── ci/pr-44  (ephemeral, created by CI, deleted on PR close)

Each branch is:
- Instant (copy-on-write, no data duplication)
- Isolated (writes don't affect main or other branches)
- Cheap (no storage cost until writes diverge)
- Auto-cleaned (deleted by CI on PR close)
```

## ci.yml template

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  neon-branch:
    name: Create Neon Branch
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 3
    outputs:
      db_url: ${{ steps.create.outputs.db_url_with_pooler }}
      branch_id: ${{ steps.create.outputs.branch_id }}
    steps:
      - name: Create ephemeral Neon branch
        id: create
        uses: neondatabase/create-branch-action@v6
        with:
          project_id: ${{ vars.NEON_PROJECT_ID }}
          api_key: ${{ secrets.NEON_API_KEY }}
          branch_name: ci/pr-${{ github.event.pull_request.number }}

  ci:
    name: Lint + Test + Quality
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: [neon-branch]
    if: always()
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: pnpm
      - run: pnpm install --frozen-lockfile

      # -- Adapt this section to your project --
      - name: Build shared packages
        run: pnpm run build:data-ops

      - name: Lint
        run: pnpm run lint:ci

      - name: Tests
        env:
          TEST_DATABASE_URL: ${{ needs.neon-branch.outputs.db_url }}
          TEST_DB_PROFILE: ${{ needs.neon-branch.outputs.db_url && 'managed' || 'local' }}
        run: pnpm run test

      # Advisory gates (adapt to your tooling)
      - name: Typecheck
        continue-on-error: true
        run: pnpm run types
      - name: Dead code
        continue-on-error: true
        run: pnpm run knip
      - name: Dep freshness
        continue-on-error: true
        run: pnpm run deps

  cleanup-neon-branch:
    name: Delete Neon Branch
    runs-on: ubuntu-latest
    timeout-minutes: 2
    needs: [neon-branch, ci]
    if: always() && needs.neon-branch.outputs.branch_id
    steps:
      - uses: neondatabase/delete-branch-action@v3
        with:
          project_id: ${{ vars.NEON_PROJECT_ID }}
          api_key: ${{ secrets.NEON_API_KEY }}
          branch: ${{ needs.neon-branch.outputs.branch_id }}
```

## deploy-stage.yml template

```yaml
name: Deploy Stage

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-stage
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment:
      name: stage
      url: https://stage.example.com
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build:data-ops
      # -- Adapt: one step per deployable app --
      - name: Deploy app-1
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: pnpm run deploy:stage:app-1
      - name: Deploy app-2
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: pnpm run deploy:stage:app-2
```

## deploy-prod.yml template

```yaml
name: Deploy Production

on:
  workflow_dispatch:
    inputs:
      ref:
        description: "Git ref to deploy (defaults to main)"
        required: false
        default: main

concurrency:
  group: deploy-prod
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    environment:
      name: production
      url: https://example.com
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.ref || 'main' }}
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build:data-ops
      # -- Adapt: one step per deployable app --
      - name: Deploy app-1
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: pnpm run deploy:prod:app-1
      - name: Deploy app-2
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: pnpm run deploy:prod:app-2
```

## Required GitHub configuration

### Secrets (Settings → Secrets and variables → Actions)

| Name | Source | Required by |
|------|--------|-------------|
| `NEON_API_KEY` | Auto (Neon GH integration) | ci.yml |
| `CLOUDFLARE_API_TOKEN` | Manual | deploy-stage/prod.yml |
| `CLOUDFLARE_ACCOUNT_ID` | Manual | deploy-stage/prod.yml |

### Variables

| Name | Source | Required by |
|------|--------|-------------|
| `NEON_PROJECT_ID` | Auto (Neon GH integration) | ci.yml |

### Environments

| Name | Reviewers | Branch policy | Used by |
|------|-----------|---------------|---------|
| `stage` | none | any | deploy-stage.yml |
| `production` | owner | protected only | deploy-prod.yml |

### Branch protection (main)

| Setting | Value |
|---------|-------|
| Required status checks | `Lint + Test + Quality` (strict) |
| Force pushes | blocked |
| Deletions | blocked |
