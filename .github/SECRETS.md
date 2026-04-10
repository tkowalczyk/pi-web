# GitHub repository configuration

This document lists the GitHub secrets, environments, and branch protection
rules required by the Phase M1-P2 CI/CD pipeline. These cannot be set from a
PR — the repo owner has to apply them manually (or via the `gh` commands
below) before the pipeline runs end-to-end successfully.

## Required repository secrets

Set in **Settings → Secrets and variables → Actions → Repository secrets**.
Used by `.github/workflows/ci.yml`, `deploy-stage.yml`, and `deploy-prod.yml`.

| Secret name             | Used by                          | Notes                                                                                                                          |
| ----------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | `deploy-stage.yml`, `deploy-prod.yml` | Cloudflare API token with **Workers Edit** + **Account Read** permissions for the powiadomienia.info account. |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy-stage.yml`, `deploy-prod.yml` | Cloudflare account ID. Run `wrangler whoami` locally to find it.                                                                |

### Set via gh CLI

```bash
gh secret set CLOUDFLARE_API_TOKEN --body "<paste-token>"
gh secret set CLOUDFLARE_ACCOUNT_ID --body "<paste-account-id>"
```

## Deferred (Phase M1-P2 follow-up)

| Secret name        | Status                                                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEON_API_KEY`     | **Not yet provisioned.** Required when CI switches from `pnpm test` (PGLite) to `pnpm test:ci` (managed Neon branch profile). Tracked as a follow-up issue. |
| `NEON_PROJECT_ID`  | Same as above.                                                                                                                                                 |

The CI workflow currently runs `pnpm test` (local PGLite profile). This is a
deliberate, documented deviation from acceptance criterion #1 ("real Postgres
branch") — see PR description for the rationale and the linked follow-up.

## Required GitHub environments

GitHub environments give us the manual approval gate for production deploys.
Set in **Settings → Environments**.

### `stage` environment

- Used by `deploy-stage.yml`
- No required reviewers
- No deployment branch restrictions (any merge to `main` deploys here)
- URL: `https://stage.powiadomienia.info`

### `production` environment

- Used by `deploy-prod.yml`
- **Required reviewers: 1** (the repo owner)
- Deployment branch restriction: `main` only
- URL: `https://powiadomienia.info`

### Set via gh CLI

```bash
# Create environments (idempotent)
gh api -X PUT "repos/:owner/:repo/environments/stage"
gh api -X PUT "repos/:owner/:repo/environments/production" \
  -F "reviewers[][type]=User" \
  -F "reviewers[][id]=<your-github-numeric-user-id>" \
  -f "deployment_branch_policy[protected_branches]=true" \
  -f "deployment_branch_policy[custom_branch_policies]=false"
```

To find your numeric user id: `gh api user -q .id`

## Branch protection on `main`

Set in **Settings → Branches → Branch protection rules**, or via `gh`:

```bash
gh api -X PUT "repos/:owner/:repo/branches/main/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Lint + Test + Quality"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

The `contexts` value must match the `name:` field of the CI job in
`.github/workflows/ci.yml` exactly. If you rename the job, update both.

## Application secrets (per-environment, in Cloudflare)

These are **not** GitHub secrets. They live in Cloudflare per worker
environment via `wrangler secret put`, and they survive across deploys (the
deploy workflows do not touch them).

Each app keeps a sync helper:

- `apps/data-service/sync-secrets.sh <env>` — reads `.{env}.vars`, pushes
  every key to `wrangler secret put --env <env>`.
- `apps/user-application/sync-secrets.sh <env>` — reads `.env.{env}`, pushes
  every key to `wrangler secret put --env <env>`.

Both `.{env}.vars` and `.env.*` files are gitignored.

### Known secret keys

Per [`apps/data-service/CLAUDE.md`](../apps/data-service/CLAUDE.md):

| Key                       | Env (stage/prod) | Notes                                          |
| ------------------------- | ---------------- | ---------------------------------------------- |
| `DATABASE_HOST`           | both             | Neon Postgres host                              |
| `DATABASE_USERNAME`       | both             | Neon Postgres username                          |
| `DATABASE_PASSWORD`       | both             | Neon Postgres password                          |
| `SERWERSMS_API_TOKEN`     | both             | SerwerSMS API token (optional after Phase 3)    |
| `SERWERSMS_SENDER_NAME`   | both             | Optional sender name override                   |

After Phase 3 purge, the SMS-related secrets become opt-in
(`FEATURE_SMS_ENABLED` flag, default off).
