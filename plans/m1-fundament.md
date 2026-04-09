# Plan: M1 Fundament

> Source PRD: [`docs/prd-m1-fundament.md`](../docs/prd-m1-fundament.md)
> Audit reference: [`docs/saas-on-cf-delta.md`](../docs/saas-on-cf-delta.md)
> Follow-up milestones: [`docs/prd-m2-notification-hub.md`](../docs/prd-m2-notification-hub.md) (stub), [`docs/prd-m3-landing-lead-capture.md`](../docs/prd-m3-landing-lead-capture.md) (stub)

## Architectural decisions

Durable decisions applied across all phases. These were locked in during `/ask:ask` and `/blueprint:blueprint` sessions and validated by the `saas-on-cf` audit — they should not re-open during execution without explicit reason.

- **Architecture style**: Cloudflare Workers monorepo (pnpm workspaces). Deep modules in the Ousterhout sense — narrow interfaces, thick implementations. Packages expose typed entry points; no cross-package leakage of internals (e.g. `drizzle` lives only inside `data-ops`).
- **Data model shape**: Single-household domain. Explicit `households` entity with one seed row (cheap back door to multi-household). Members linked by `household_id`. Notification sources as data records with polymorphic JSON config and typed handlers in code. Channels as first-class entity (port + adapters).
- **Key entities**: `household`, `household_member`, `channel`, `notification_source`. Tenant/organization/workspace primitives are explicitly absent.
- **Authentication**: Better Auth with email+password and Google OAuth. Already clean of multitenant artifacts per audit — no simplification required. Role binding (`admin` / `member`) scoped to the single household, exposed via a thin auth facade.
- **Scheduling model**: Durable Object per notification source. DB is source of truth for schedule config. DOs subscribe to changes via RPC. Data flow: `UI → mutation → data-ops → DO RPC → alarm()`.
- **Delivery model**: `NotificationChannel` port with pluggable adapters. `TelegramChannel` (stub in M1, full in M2), `SerwerSMSChannel` (refactored behind `FEATURE_SMS_ENABLED` env var, default off), `NoopChannel` (test double in `test-harness`).
- **Testing**: Full pyramid under strict TDD. Unit tests for pure domain logic (vitest), integration tests for data-ops (PGLite locally, Neon branch in CI), end-to-end tests for worker + DO behavior (`@cloudflare/vitest-pool-workers`). All new code red → green → refactor.
- **CI/CD**: GitHub Actions. Branch protection on `main` with required `test:ci` check. Auto-deploy to stage on merge, manual approval gate for prod. Secrets per-environment via `wrangler secret put`.
- **Template relationship**: `saas-on-cf` is a reference template, not a live dependency. Patterns are cherry-picked. Lessons learned during M1 flow back into the template via the retro document.
- **Out of scope across all phases**: Real Telegram delivery, working notification dispatch for the family, new notification source types beyond stubs, UI for source management, landing page, payment integration, multi-household support, webhook-based bot (all deferred to M2/M3).

---

## Phase 1: Test harness smoke + quick-wins

**User stories**: 6, 7, 8, 9, 10, 11, 29b, 29c

### What to build

Unblock everything downstream by creating a working test loop from a clean package state. Fix the latent `vitest` version bug first (unified to v4.x across the workspace, moved out of runtime dependencies), then rebrand the project away from the legacy `saas-kit` name. Port the template's root-level vitest configuration using the projects pattern so that a single `pnpm test` runs all packages. Wire two test database profiles: an embedded in-memory profile for fast local iteration, and a managed Postgres branch profile for CI fidelity. Introduce a shared `test-harness` package that exposes factories for test databases, fixtures, and a no-op notification channel. Prove the harness works end-to-end by writing one trivial integration test that exercises a round-trip through the data-ops client against the in-memory DB profile.

### Acceptance criteria

- [ ] `vitest` is a single consistent major version across every package, declared only as a dev dependency
- [ ] Root `package.json` and all workspace names reflect `powiadomienia-info`, not `saas-kit`; a repo-wide grep for the old name returns zero hits outside archived docs
- [ ] `pnpm test` runs unified test suite across all workspace packages
- [ ] `pnpm test` uses the fast local DB profile and completes in under ten seconds from a cold start
- [ ] `pnpm test:ci` uses the managed Postgres branch profile and requires only standard CI secrets
- [ ] `test-harness` package exposes at minimum: a function that creates a fresh seeded test database, a no-op channel double that records invocations, and resettable fixture factories
- [ ] At least one integration test is written, passes on both profiles, and exercises a real data-ops query (not a mocked one)
- [ ] No dead test dependencies remain anywhere in the workspace

---

## Phase 2: CI/CD regression gate

**User stories**: 31, 32, 33, 34, 35

### What to build

Stand up the continuous integration pipeline so that every subsequent phase can rely on automated regression protection. Port the template's workflow set and adapt it to the project's multi-environment layout. The pipeline must run the CI test profile on every pull request, block merge on failure, and enforce code quality gates (linting, dead code detection, dependency freshness checks). On merge to main, the pipeline deploys the worker and frontend to stage automatically. Production deploys require manual approval. All secrets move into per-environment wrangler bindings — nothing credential-like lives in the repo. The phase itself is validated by opening a pull request that exercises the new gates before it can merge.

### Acceptance criteria

- [ ] Every pull request triggers a CI run that executes the CI test profile against a real Postgres branch
- [ ] `main` branch is protected with required status checks that block merge on CI failure
- [ ] Merge to `main` triggers automatic deploy of both apps to the stage environment
- [ ] Production deploy requires manual approval from the repo owner
- [ ] Linter, dead code checker, and dependency freshness tools are configured at repo root and run as part of CI
- [ ] All environment secrets are managed via per-environment wrangler bindings, not committed files
- [ ] The pull request that introduces this phase is itself merged only after passing its own new gates

---

## Phase 3: Purge SaaS debt

**User stories**: 12, 29a

### What to build

Remove the entire legacy SaaS payment stack that was inherited from the original fork and never cleaned up. This covers third-party payment integration code, pricing UI components, subscription server functions, all payment-related data-ops queries, payment-related schema tables, and any wrangler secrets tied to payment providers. Historical payment documentation moves to an archive folder rather than being deleted outright, so the intent of the old design is preserved as context. The test harness from Phase 1 acts as a safety net during the purge — after each deletion wave, the existing tests must continue to pass and the build must remain clean. The end state is a codebase where a repository-wide search for payment-related terms returns zero hits outside the archive folder.

### Acceptance criteria

- [ ] All payment-related source directories in both apps are deleted
- [ ] All payment-related queries and their consumers in `data-ops` are deleted
- [ ] Payment-related schema tables are removed via a clean migration that applies successfully on fresh and existing databases
- [ ] Payment-related wrangler secrets are removed from all environments
- [ ] Historical payment design docs are moved to an archive folder with a brief note explaining the pivot
- [ ] A repository-wide search for the names of the removed payment providers returns zero hits outside the archive folder
- [ ] `pnpm test` and `pnpm test:ci` both pass
- [ ] `pnpm build` passes for both apps
- [ ] CI pipeline from Phase 2 is green on the phase's pull request

---

## Phase 4: Monorepo alignment + observability baseline

**User stories**: 2, 3, 4, 36, 37

### What to build

Align the project's internal structure with the current template conventions now that the payment debt is gone. Port the template's agent-facing documentation file at repo root, the layered worker structure that separates handlers, services, middleware, types, and utilities into distinct subdirectories inside the worker hono module. Replace the current ad-hoc middleware placement with this layered layout. As part of the same restructuring, port the template's observability middleware set: a request correlation id assigned at the edge, a structured error handler that produces consistent error responses, a CORS middleware, and a baseline rate limiter. Introduce a minimal structured logger that binds the request id so logs from downstream calls can be correlated. Do not introduce external observability services (Sentry, analytics engine) — those are nice-to-haves for later milestones. Deep module boundaries are enforced by a CI check that guards against cross-package internal imports.

### Acceptance criteria

- [ ] Worker source is organized into layered subdirectories matching the template's convention
- [ ] There is no parallel middleware or services directory living outside the hono module
- [ ] Every HTTP request receives a correlation id header, propagated through downstream calls and included in logs
- [ ] Errors thrown in worker handlers are caught by the error handler middleware and rendered as structured responses with a consistent shape
- [ ] CORS and baseline rate limiting middleware are active on public endpoints
- [ ] Structured logger is available across the worker and is used by at least one real code path
- [ ] CI has an import boundary check that fails if a package imports another package's internals (e.g. `drizzle` is imported outside `data-ops`)
- [ ] Repo-root agent documentation file is present and describes the layered worker structure
- [ ] All Phase 1 tests still pass; CI green

---

## Phase 5: Domain model end-to-end

**User stories**: 13, 14, 15, 16, 17, 18, 28, 30

### What to build

This is the first real vertical slice of new product functionality. Define the core domain entities in the database schema: household (with a single seed row inserted by migration), household members, delivery channels, and notification sources. Each table has co-located zod validation schemas that match the drizzle types at compile and runtime. The `data-ops` package exposes a typed query layer covering the CRUD operations needed in M1 for all four entities — no raw drizzle leaks out of the package. The existing Better Auth configuration gets a minimal role binding layer (`admin` / `member` scoped to the single household) — since the audit confirmed auth is already free of multitenant artifacts, this is additive only, not a rewrite. A thin auth facade is exposed so apps never touch Better Auth primitives directly. To prove the slice really cuts end-to-end, wire one minimal server function in the frontend app that lists household members — the smallest possible demonstration that the full vertical (auth → server function → data-ops query → typed response) works. Integration tests cover every query on both the fast and CI database profiles, and TDD discipline is enforced: tests written before implementation, verified in the git history.

### Acceptance criteria

- [ ] Schema contains `households`, `household_members`, `channels`, `notification_sources` tables with appropriate foreign keys and indexes
- [ ] A migration seeds exactly one household row on fresh database creation
- [ ] Zod schemas exist for all four entities and are derived from or validated against the drizzle types
- [ ] Typed queries cover all CRUD paths needed in M1 for all four entities, exposed from `data-ops` as a public API
- [ ] Integration tests pass on both the fast local DB profile and the CI Postgres branch profile
- [ ] Role binding (`admin` / `member`) is present in the auth layer and restricted to the single household
- [ ] A thin auth facade exposes current user, household admin enforcement, and member listing without leaking Better Auth internals
- [ ] One server function in the frontend app successfully lists household members and returns a typed response
- [ ] Git history for this phase shows test-first commits for the new domain code
- [ ] Import boundary check from Phase 4 confirms no drizzle leakage outside `data-ops`
- [ ] CI green

---

## Phase 6: NotificationChannel port + adapters + domain module

**User stories**: 10, 19, 20, 21, 22, 23

### What to build

Introduce the delivery abstraction that M2 will build on, without yet delivering anything to the real world. Define the `NotificationChannel` port as a narrow interface: a `send` method taking a notification payload and returning a delivery result, with an explicit error taxonomy. Build three adapters against this port: a Telegram channel stub that is type-complete but throws a clear "not implemented" error on send (the real implementation is M2), a SerwerSMS channel that wraps the existing legacy client behind the port and is gated by the `FEATURE_SMS_ENABLED` environment variable (default off — throws a "feature disabled" error when the flag is false), and a no-op channel living in the `test-harness` package that records invocations for assertions. Write a contract test suite that every adapter must pass, covering interface shape, error taxonomy, and idempotency behavior. Alongside the port, build the pure `domain/notification` module: zero I/O, zero dependencies beyond data-ops types and zod. It exports functions that compute the next scheduled run for a source and render a source into a notification payload. Unit tests cover this module to 100%. Prove the slice by wiring an integration test that pulls a notification source from the database via data-ops, runs it through the domain module, dispatches the result through the port to the no-op channel, and asserts on the recorded invocation.

### Acceptance criteria

- [ ] `NotificationChannel` port is a single small interface with an explicit error taxonomy
- [ ] `TelegramChannel` adapter exists, type-checks against the port, and throws "not implemented" on send with an asserted test covering the throw
- [ ] `SerwerSMSChannel` adapter wraps legacy SMS code behind the port and is gated by `FEATURE_SMS_ENABLED`; default is off
- [ ] `NoopChannel` adapter in `test-harness` records all invocations in an in-memory list that is resettable per test
- [ ] Contract test suite exists and every adapter passes it
- [ ] `domain/notification` module has zero imports from channel implementations, the DO runtime, or app code
- [ ] Exported functions from the domain module have 100% unit test coverage verified by the test reporter
- [ ] At least one integration test wires the full slice: data-ops → domain → port → no-op adapter → assertion on recorded invocation
- [ ] Git history shows test-first commits for the new domain and adapter code
- [ ] CI green

---

## Phase 7: SchedulerDO scaffold

**User stories**: 24, 25, 26, 27

### What to build

Port the template's Durable Object scaffold into the project's worker and shape it into the scheduler primitive that M2 will fill in with real dispatch logic. The scheduler is bound one-per-notification-source. Its RPC surface is deliberately thin: update the schedule configuration, trigger a run immediately, and return current state. The alarm handler delegates all real work — schedule computation to the domain module, delivery to the channel port. The DO itself owns no business logic and no drizzle imports; it references only ports and data-ops typed queries. The database remains the source of truth for schedule config — when `updateSchedule` is called, the DO reads the live config via data-ops, recomputes the next alarm time using the domain module, and persists only the alarm timestamp in DO storage. The wrangler configuration gains the new durable object namespace binding for both environments. Tests run inside the Cloudflare vitest pool: creating an instance of the DO, calling its RPC surface, advancing a test clock, asserting the alarm fires at the expected time, and asserting the no-op channel recorded the delivery. Because the DO has no real channel wired and no real domain rules yet, the tests use synthetic notification sources and the no-op channel from Phase 6 — this is deliberate, keeping M1 strictly foundational.

### Acceptance criteria

- [ ] A `SchedulerDO` class is defined, bound to a durable object namespace in wrangler config for both environments
- [ ] RPC surface supports updating the schedule, triggering a run immediately, and returning current state
- [ ] The alarm handler delegates schedule computation to the domain module and delivery to a channel via the port
- [ ] The DO has no direct imports of drizzle or channel adapter implementations
- [ ] The database is the source of truth: on schedule update, the DO reads configuration via data-ops and stores only the next alarm timestamp in DO storage
- [ ] Tests run in the Cloudflare vitest pool and cover: DO creation, schedule update, alarm firing at an expected time using a test clock, immediate trigger, and channel invocation recorded by the no-op channel
- [ ] Tests use synthetic notification sources and the no-op channel — no real Telegram or SMS wiring is attempted
- [ ] Git history shows test-first commits for DO behavior
- [ ] CI green

---

## Phase 8: Stage + Prod deploy + M1 retro

**User stories**: 1, 5, 38

### What to build

Close the milestone by putting the foundation in both live environments and capturing lessons learned. Finalize the wrangler configuration so the durable object namespace exists in both stage and production, and deploy both apps. Verify on each environment that the new schema is applied, the single household seed row exists, and the durable object namespace is active and bound. Run a repo-wide audit confirming zero lingering tenant or legacy SaaS references outside the archive. Write the retrospective document at `docs/m1-retro.md` — not a simple "what went well" list, but a focused document identifying concrete patterns, configuration choices, or workflow improvements that should flow back into the `saas-on-cf` template as improvements for future forks. Candidates surfaced during the milestone include the multi-environment migrations layout (which was already better than the template and deserves back-porting), the i18n and auth UX improvements, and any new insights on testing durable objects or running hybrid PGLite/Neon profiles. The retro document is the formal close of the milestone. After it is merged, the milestone is closed on GitHub and M2 is unblocked.

### Acceptance criteria

- [ ] Stage environment runs the refactored worker and frontend, has the new schema applied, and contains the seeded household
- [ ] Production environment runs the refactored worker and frontend, has the new schema applied, and contains the seeded household
- [ ] Durable object namespace is active and bound in both environments
- [ ] Repo-wide grep for legacy tenant and SaaS terms returns zero hits outside the archive folder
- [ ] `docs/m1-retro.md` exists and lists at least three concrete back-port candidates for the `saas-on-cf` template with enough detail that they could be filed as issues on the template repo
- [ ] `docs/saas-on-cf-delta.md` audit report is referenced from the retro as the baseline
- [ ] GitHub milestone M1 is closed; all M1 issues are closed
- [ ] M2 stub PRD is updated with a pointer to the retro so the next discovery round starts from that context
