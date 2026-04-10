---
name: setup-ci
description: Set up a complete CI/CD pipeline for a pnpm monorepo deployed to Cloudflare Workers with Neon Postgres. Creates GitHub Actions workflows (CI gate, stage auto-deploy, prod manual deploy), quality gate tooling (Biome, Knip, Taze), test-harness with dual DB profile (PGLite local / Neon ephemeral branches), secrets management, branch protection, and environment approval gates.
---

# CI/CD Pipeline Setup

Sets up production-grade CI/CD for **pnpm monorepo + Cloudflare Workers + Neon Postgres** projects in one session.

## Usage

```
/setup-ci            — full interactive setup from scratch
/setup-ci --audit    — audit existing setup, report gaps, fix them
```

## What gets created

| Category | Files | Purpose |
|----------|-------|---------|
| CI workflow | `.github/workflows/ci.yml` | PR gate: Neon branch + lint + test + advisory checks |
| Stage deploy | `.github/workflows/deploy-stage.yml` | Auto-deploy on merge to main |
| Prod deploy | `.github/workflows/deploy-prod.yml` | Manual deploy with reviewer approval |
| Lint | `biome.json` | Biome linter + formatter config |
| Dead code | `knip.json` | Unused code/deps detector |
| Dep freshness | `taze.config.ts` | Minor-version dependency staleness |
| Test harness | `packages/test-harness/src/db.ts` | Dual PGLite/Neon DB factory |
| Docs | `.github/SECRETS.md` | Required secrets, environments, branch protection |
| Scripts | `package.json` (root) | `lint`, `lint:ci`, `knip`, `deps`, `types` scripts |

## Workflow

### 1. Discovery (ask before generating)

Collect project-specific values. Do NOT generate files until all answers are confirmed.

**Questions to ask:**

1. **Monorepo layout** — "Which packages deploy as Cloudflare Workers? List the app directories (e.g. `apps/data-service`, `apps/user-application`)."

2. **Database** — "Is Neon Postgres already set up? Is the Neon GitHub integration connected to this repo?" Verify with:
   ```bash
   gh secret list | grep NEON
   gh variable list | grep NEON
   ```
   If not connected, guide user to: Neon Console → Project → Integrations → GitHub → connect repo.

3. **Cloudflare** — "Do you have `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub secrets?" Verify with:
   ```bash
   gh secret list | grep CLOUDFLARE
   ```
   If not: guide user to create API token at https://dash.cloudflare.com/profile/api-tokens (template: "Edit Cloudflare Workers"), get account ID via `pnpm exec wrangler whoami`.

4. **Environments** — "What are your environment names in wrangler.jsonc? (e.g. `stage`, `prod`)"

5. **Deploy commands** — "What commands deploy each app to each env?" Check existing `package.json` scripts. Typical: `wrangler deploy --env stage`.

6. **Data-ops package** — "Where is the drizzle schema? Where are dev migrations?" Typical: `packages/data-ops/src/drizzle/schema.ts`, `packages/data-ops/src/drizzle/migrations/dev/`.

7. **Test harness** — "Does `packages/test-harness` already exist?" If yes, check for dual profile support. If no, create it.

8. **Production reviewer** — "Who should approve production deploys?" Get their GitHub username.

### 2. Generate files

After confirming answers, generate all files. Use the reference templates in `references/` — adapt them to the project's specifics (app names, deploy commands, migration paths, environment names).

**Generation order matters:**

1. `biome.json` → `knip.json` → `taze.config.ts` (quality gate configs)
2. Root `package.json` scripts (`lint`, `lint:ci`, `knip`, `deps`, `types`)
3. `packages/test-harness/src/db.ts` (dual DB profile)
4. `packages/test-harness/tests/managed-profile.test.ts` (conditional Neon test)
5. `.github/workflows/ci.yml` (depends on test-harness existing)
6. `.github/workflows/deploy-stage.yml`
7. `.github/workflows/deploy-prod.yml`
8. `.github/SECRETS.md`

After generating, run:
```bash
pnpm install                    # install new devDeps
pnpm exec biome check --write . # format generated files
pnpm test                       # verify local profile works
pnpm lint:ci                    # verify lint passes
```

### 3. Configure GitHub (interactive, requires user confirmation)

These commands modify shared state — confirm each before running.

```bash
# Environments
gh api -X PUT "repos/:owner/:repo/environments/stage"
gh api -X PUT "repos/:owner/:repo/environments/production" --input - <<EOF
{
  "reviewers": [{"type": "User", "id": $(gh api user -q .id)}],
  "deployment_branch_policy": {"protected_branches": true, "custom_branch_policies": false}
}
EOF

# Branch protection (run AFTER first CI passes on main)
gh api -X PUT "repos/:owner/:repo/branches/main/protection" --input - <<EOF
{
  "required_status_checks": {"strict": true, "contexts": ["Lint + Test + Quality"]},
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

### 4. Verify

Open a test PR to verify the full pipeline:

```bash
git checkout -b test/ci-pipeline
echo "# test" >> .github/SECRETS.md
git add . && git commit -m "test: verify CI pipeline"
git push -u origin test/ci-pipeline
gh pr create --title "test: verify CI pipeline" --body "Testing CI. Will close after green."
```

Watch the run:
```bash
gh run list --branch test/ci-pipeline --limit 1
gh run watch <run-id> --exit-status
```

Expected result:
- `Create Neon Branch` — green (ephemeral branch created)
- `Lint + Test + Quality` — green (all hard gates pass)
- `Delete Neon Branch` — green (cleanup)

After green: close the PR without merging (`gh pr close`).

## Architecture reference

See [ci-pipeline-architecture.md](./references/ci-pipeline-architecture.md) for the full pipeline architecture diagram and detailed explanation of each component.

## Biome scope strategy

When adding Biome to a project with existing code:

1. **Start narrow** — exclude legacy directories (`!apps`, `!packages/legacy-pkg`) in `biome.json` `files.includes`
2. **New code only** — all new packages/files are covered from day one
3. **Ramp up incrementally** — after each cleanup phase, remove one exclusion
4. **Rules severity** — start problematic rules as `"warn"`, flip to `"error"` after cleanup
5. **Never `--write --unsafe` on existing code** — it changes semantics (e.g. `!.` to `?.`)

## Test-harness design

See [test-harness-pattern.md](./references/test-harness-pattern.md) for the dual-profile pattern, migration bootstrap, and injection seam.

## Secrets management

Two categories — never mix them:

| Category | Lives in | Managed by | Example |
|----------|----------|------------|---------|
| CI/deploy secrets | GitHub Secrets/Variables | Neon integration (auto) + manual | `NEON_API_KEY`, `CLOUDFLARE_API_TOKEN` |
| App runtime secrets | Cloudflare Workers (per-env) | `sync-secrets.sh` + `wrangler secret put` | `DATABASE_HOST`, `SERWERSMS_API_TOKEN` |

CI/deploy secrets enable the pipeline. App runtime secrets are opaque to CI — they live in Cloudflare and survive across deploys.

## Acceptance checklist

After `/setup-ci` completes, verify:

```
[ ] `pnpm lint:ci` exits 0
[ ] `pnpm test` exits 0 (local PGLite profile)
[ ] `pnpm knip` runs (advisory, may report findings)
[ ] `pnpm deps` runs (advisory)
[ ] `pnpm types` runs (advisory)
[ ] `.github/workflows/ci.yml` exists and is valid YAML
[ ] `.github/workflows/deploy-stage.yml` exists
[ ] `.github/workflows/deploy-prod.yml` exists
[ ] `NEON_API_KEY` secret exists in repo (`gh secret list`)
[ ] `NEON_PROJECT_ID` variable exists in repo (`gh variable list`)
[ ] `CLOUDFLARE_API_TOKEN` secret exists in repo
[ ] `CLOUDFLARE_ACCOUNT_ID` secret exists in repo
[ ] GitHub environment `stage` exists
[ ] GitHub environment `production` exists with required reviewer
[ ] Branch protection on `main` with required CI check
[ ] Test PR opened → CI green → PR closed
```
