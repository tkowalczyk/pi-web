# PRD — M1 Fundament

**Milestone:** M1 Fundament (pierwszy z trzech: M1 Fundament → M2 Personal Notification Hub → M3 Landing + Lead Capture)
**Status:** Draft (revised post-audit 2026-04-09)
**Data:** 2026-04-09
**Discovery:** `/ask:ask` session + `/blueprint:blueprint` session (patrz historia rozmowy)
**Audit findings:** [docs/saas-on-cf-delta.md](./saas-on-cf-delta.md) — wpłynęły na rewizję scope (Better Auth issue usunięty, purge SaaS debt + quick-win fix dodane, kolejność zrewidowana)
**Poprzednik w łańcuchu planowania:** `/ask:ask` → `/blueprint:blueprint` → **this PRD** → audit → **revised PRD** → `/carve:carve` → `/dispatch:dispatch`

## Problem Statement

Projekt `powiadomienia.info` (`pi-web`) został zbudowany jako fork szablonu `saas-on-cf` — wielodostępnego SaaS-a na Cloudflare. Szablon od tego czasu znacząco ewoluował: pojawiły się nowsze wzorce architektoniczne (deep modules w duchu Ousterhouta), lepsze data-ops patterns, test harness, observability. `pi-web` został w tyle i zbiera dług techniczny.

Jednocześnie projekt ma zostać **zpivotowany** — z wielodostępnego SaaS-a do SMS dla mieszkańców na **osobiste (rodzinne) centrum powiadomień**, gdzie rdzeniem dostarczenia jest Telegram channel z topicami, a nie SMS. Multitenant znika. Pojawia się model domeny oparty o household + members + notification sources.

Fundament techniczny musi zostać uporządkowany **zanim** zaczniemy budować nowe funkcje, bo:
- Brak test harness uniemożliwia rygorystyczne TDD, które jest wymagane dla dalszych milestone'ów.
- Artefakty multitenant rozlane po schema, auth i query layer będą powodować tarcie przy każdej nowej feature.
- Bez portingu nowych wzorców z `saas-on-cf` każda praca będzie re-implementować rzeczy, które już są rozwiązane w templacie.
- `saas-on-cf` jest **referencyjnym template** autora dla wielu projektów — lessons learned z M1 wracają do template i będą korzystać innym projektom.

Z perspektywy właściciela produktu (sole developer): *„Chcę mieć czysty fundament, na którym mogę z przekonaniem robić TDD dla M2 i M3, zamiast ciągle walczyć ze starym kodem.”*

## Solution

M1 Fundament dostarcza zaktualizowany fundament architektoniczny dla `pi-web` oparty o najnowsze wzorce z `saas-on-cf`, z rygorystycznym test harness, uproszczoną domeną (multitenant usunięty, household jako jawna encja), abstrakcją kanałów dostarczenia (`NotificationChannel` port + adaptery) i scaffoldem Durable Object per notification source.

Po zamknięciu M1:
- `pi-web` ma strukturę monorepo zgodną z aktualnym `saas-on-cf`, z deep modules i jasnymi granicami pakietów.
- Pełna piramida testów działa: unit (vitest), integration (data-ops z PGLite lokalnie / Neon branch w CI), e2e (`@cloudflare/vitest-pool-workers`). TDD red-green-refactor jest standardem dla całego nowego kodu.
- Model domeny jest wyczyszczony: `household` (jeden rekord seed), `household_members`, `notification_sources` z polimorficzną konfiguracją, relacje do zdefiniowanych `channels`.
- `NotificationChannel` port istnieje jako wąski interfejs z trzema adapterami: `TelegramChannel` (stub, pełna implementacja w M2), `SerwerSMSChannel` (refactor istniejącego kodu za interfejs, wyłączony flagą `FEATURE_SMS_ENABLED=false`), `NoopChannel` (do testów).
- `SchedulerDO` istnieje jako scaffold per `notification_source` z `alarm()` i RPC surface (`updateSchedule`, `triggerNow`), testowany w izolacji. Pełna logika dispatcherowa jest w M2.
- Better Auth skonfigurowany w uproszczonej wersji (jeden household, role admin/member, bez tenant switchingu).
- Pipeline CI/CD blokuje merge do `main` bez zielonych testów, automatycznie deployuje na stage, a prod deployuje przez manual approval.
- `saas-on-cf` audit delta report (`docs/saas-on-cf-delta.md`) jest zapisany jako punkt wyjścia i stanowi żywą referencję.

Po M1 nie ma jeszcze działającego powiadomienia end-to-end na Telegramie — to jest M2. M1 dowozi **infrastrukturę**.

## User Stories

Aktor główny: **Developer/Owner** (jeden człowiek, autor projektu, jedyny utrzymujący). Użytkownicy końcowi (rodzina) pojawiają się dopiero w M2.

### Fundament architektoniczny

1. As a **Developer**, I want a written delta report between current `pi-web` and updated `saas-on-cf` template, so that I know exactly which patterns to port and in what order.
2. As a **Developer**, I want the monorepo structure of `pi-web` to match the current `saas-on-cf` conventions, so that I can cherry-pick improvements from the template without structural friction in the future.
3. As a **Developer**, I want clear package boundaries with path aliases and typed exports, so that no code leaks across module boundaries (e.g. no drizzle imports outside `data-ops`).
4. As a **Developer**, I want all deep modules to expose narrow interfaces with thick implementations, so that I can change internals without breaking consumers.
5. As a **Developer**, I want retro notes captured in `docs/m1-retro.md`, so that lessons learned flow back into the `saas-on-cf` template for future projects.

### Test harness + TDD

6. As a **Developer**, I want vitest + `@cloudflare/vitest-pool-workers` configured at the repo root, so that I can run `pnpm test` and get a unified test run across all packages.
7. As a **Developer**, I want PGLite-backed integration tests for `data-ops` that run in milliseconds locally, so that TDD loop is fast.
8. As a **Developer**, I want Neon branch-backed integration tests for `data-ops` that run in CI only (`pnpm test:ci`), so that I catch PG dialect differences before deploy.
9. As a **Developer**, I want test factories and fixtures exposed from a shared `test-harness` module, so that individual test files don't re-implement seeding.
10. As a **Developer**, I want a mock `NoopChannel` adapter, so that domain tests can assert on emitted payloads without hitting real services.
11. As a **Developer**, I want every new file in M1 to be written test-first (red → green → refactor), so that TDD discipline is established from day one.

### Model domeny (usunięcie multitenant, household as-is)

12. As a **Developer**, I want all tenant-related tables, columns, and code paths removed from the schema, so that the data model reflects the new product shape.
13. As a **Developer**, I want a `households` table with a single seed row inserted by migration, so that the app always has an implicit household without needing runtime creation logic.
14. As a **Developer**, I want a `household_members` table linked by `household_id`, so that family members can be named and referenced by future notification sources.
15. As a **Developer**, I want a `notification_sources` table with `type`, `config JSONB`, `target_channel_id`, `target_topic_id`, `schedule_config JSONB`, `is_active`, so that sources are data-driven while handlers stay in code.
16. As a **Developer**, I want a `channels` table describing available delivery channels with type discriminator, so that `notification_sources` can reference them by foreign key.
17. As a **Developer**, I want zod schemas co-located with drizzle schemas for every table, so that server functions validate at the boundary.
18. As a **Developer**, I want typed queries in `data-ops` covering all CRUD paths needed in M1, so that apps never import drizzle directly.

### NotificationChannel abstraction

19. As a **Developer**, I want a `NotificationChannel` port with a `send(payload)` method returning a `DeliveryResult`, so that the domain layer can dispatch without knowing channel internals.
20. As a **Developer**, I want `TelegramChannel` as a stub adapter in M1 (type-safe surface, throws `NotImplemented` on send), so that M2 implementation has a contract to fulfill.
21. As a **Developer**, I want the existing SerwerSMS code refactored behind a `SerwerSMSChannel` adapter gated by `FEATURE_SMS_ENABLED` env var (default `false`), so that the SMS option can be reactivated later without rewriting.
22. As a **Developer**, I want a `NoopChannel` adapter that records invocations in-memory, so that tests can assert on delivery without side effects.
23. As a **Developer**, I want contract tests that every adapter must pass, so that adapters are interchangeable by construction.

### SchedulerDO scaffold

24. As a **Developer**, I want a `SchedulerDO` class per `notification_source` with `alarm()`, `updateSchedule(config)` RPC, and `triggerNow()` RPC, so that M2 has a stateful hook ready for scheduling logic.
25. As a **Developer**, I want DB as the source of truth for schedule config and DO as a subscriber via RPC, so that the data flow is `UI → mutation → data-ops → DO RPC → alarm()` and debugging means reading the DB.
26. As a **Developer**, I want `SchedulerDO` to be testable in isolation via `@cloudflare/vitest-pool-workers`, so that scheduling correctness can be verified without integration friction.
27. As a **Developer**, I want `SchedulerDO` to delegate business logic to `domain/notification` module (not own it), so that the DO stays thin and swappable.

### Auth role binding (NIE osobny refactor — audit pokazał że Better Auth już jest czysty)

28. As a **Developer**, I want `admin` / `member` role binding added to existing Better Auth config scoped to a single household, so that role-based access works without restructuring auth. **Note:** audit (docs/saas-on-cf-delta.md, obszar 3) potwierdził że Better Auth w pi-web nie ma żadnych multitenant artifacts — tenant/workspace/organization są nieobecne. Pierwotny plan „Better Auth simplified” jest zbędny. Rola binding wchodzi jako część domain model issue (patrz #28), nie osobny issue.
29. As a **Developer**, I want a thin auth facade (`getCurrentUser`, `requireHouseholdAdmin`, `listMembers`) exposed to apps, so that apps don't import Better Auth primitives directly.

### Purge SaaS debt (nowe issue — zidentyfikowane w audycie)

29a. As a **Developer**, I want the entire Stripe/BLIK/subscription vertical removed from pi-web (code, schema, queries, docs, wrangler secrets), so that the codebase reflects the post-pivot greenfield state and no dead code remains to confuse future changes. Scope: `apps/data-service/src/stripe/`, `apps/user-application/src/components/pricing/`, `apps/user-application/src/core/functions/subscription.ts`, `packages/data-ops/src/queries/{stripe-customer,payment,payments,subscription,webhook-events}.ts`, schema tables related to payments, `docs/010-payments.md` moved to `docs/archive/`. See audit obszar 9.

### Quick-wins (nowe issue — zidentyfikowane w audycie)

29b. As a **Developer**, I want `vitest` version mismatch fixed (moved from `data-ops/dependencies` to `devDependencies`, unified to `^4.x` across all packages), so that the test harness bootstrap doesn't fight package manager conflicts. See audit obszar 12.
29c. As a **Developer**, I want the repo rebranded from `saas-kit` to `powiadomienia-info` (root + per-package package.json names, README, CHANGELOG), so that grep and package discovery work correctly. See audit obszar 10.

### CI/CD and deploy

31. As a **Developer**, I want a GH Actions pipeline that runs `pnpm test:ci` on every PR, so that broken tests block merge.
32. As a **Developer**, I want `main` branch protected with required status checks, so that nothing lands without a green run.
33. As a **Developer**, I want automatic deploy-to-stage on merge to `main`, so that stage always reflects head.
34. As a **Developer**, I want manual approval gate for deploy-to-prod, so that I control production releases explicitly.
35. As a **Developer**, I want secrets managed via `wrangler secret put` per environment, so that no credentials live in the repo.

### Observability (porting from saas-on-cf)

36. As a **Developer**, I want structured logging patterns ported from `saas-on-cf`, so that logs are queryable.
37. As a **Developer**, I want error tracking wired (whatever `saas-on-cf` uses), so that failures in M2+ are visible.

### Definition of Done for M1

38. As a **Developer**, I want M1 closed only when: all issues merged, tests green, stage deployed, prod deployed, and the `households`/`members`/`notification_sources` tables exist live in prod with seed data, so that M2 can start on a real foundation.

## Implementation Decisions

Decisions reached during `/ask:ask` and blueprint interview. Full discovery transcript available in session history.

### Scope & sequencing (revised post-audit)
- **M1 is foundation only.** No user-visible notification delivery in M1. Telegram delivery is M2.
- **Greenfield.** No existing users in prod to migrate. Schema can be destructively rebuilt.
- **`saas-on-cf` is a reference template, not a live dependency.** Patterns are cherry-picked manually. No subtree/submodule.
- **Audit delta** (`docs/saas-on-cf-delta.md`) is done. Findings:
  - Better Auth is already clean — no simplification needed. Issue removed from scope.
  - Stripe/BLIK/subscription debt is substantial and must be purged as separate issue.
  - `vitest` version mismatch bug + `saas-kit` name not rebranded — quick-win issue added.
  - CI/CD must move earlier (between test harness and domain model) to enable regression gates for subsequent issues.
  - `SchedulerDO` scaffold and `NotificationChannel` port split into two separate issues — DO is its own experiment with its own risk.
  - Observability baseline (request-id, error-handler middleware, structured logger) bundled with DO issue since both live in the worker layer.
- **Final M1 sequence (10 issues):**
  1. Audit delta — done
  2. Quick-wins (vitest mismatch + rebranding)
  3. Test harness bootstrap (root vitest + workers pool + PGLite + Neon profile + test-harness package)
  4. CI/CD pipeline (GH Actions test + release + branch protection + biome/knip/taze)
  5. Purge SaaS debt (delete Stripe/BLIK/subscription vertical)
  6. Align monorepo structure (port root configs, restructure `hono/` into layered dirs)
  7. Domain model — household + members + channels + notification_sources (includes auth role binding)
  8. NotificationChannel abstraction + adapters (port interface, Telegram stub, SerwerSMS behind flag, NoopChannel)
  9. SchedulerDO scaffold + observability baseline (port example DO, RPC surface, tests, request-id/error-handler middleware)
  10. M1 retro (docs/m1-retro.md with back-port candidates for saas-on-cf template)

### Architectural decisions
- **Deep modules (Ousterhout).** Core modules expose narrow interfaces with thick implementations. Validation criteria (see below) enforce this for data-ops, domain/notification, NotificationChannel port, and SchedulerDO.
- **Household as explicit entity with single seed row.** Not an implicit singleton. Cheap "back door" to multi-household pivot later.
- **`notification_sources` as DB records + handlers in code.** Adding a new type = PR with handler. Adding an instance = DB insert via UI (M2).
- **DB is source of truth for schedule config.** Durable Objects subscribe via RPC. Data flow: `UI → mutation → data-ops → DO RPC → alarm()`.
- **Durable Object per notification source.** Not a singleton scheduler. Chosen for isolation, parallelism, and testability. One DO per source.
- **Telegram channel is one-way.** Worker → Telegram Bot API, no webhook. Family reads and comments in Telegram; system does not listen back. (M2.)
- **`NotificationChannel` abstraction mandatory.** Even with only Telegram planned, the port exists from day one. SerwerSMS refactored behind the port, not deleted.
- **`FEATURE_SMS_ENABLED` as env var.** Not a DB flag. YAGNI — refactor to `feature_flags` table only when second flag appears.

### Testing decisions
- **Full test pyramid.** Unit (pure functions in domain) + integration (data-ops with real PG) + e2e (workers pool with mocked external services).
- **Hybrid test DB strategy.** PGLite for local `pnpm test` (fast feedback), Neon branch for `pnpm test:ci` (full PG fidelity). Two vitest profiles.
- **Strict TDD for all new code.** Red → green → refactor. No code merged without tests written first.
- **Validation criteria enforced for deep modules only** (data-ops, domain/notification, NotificationChannel, SchedulerDO). Shallow modules (auth facade, apps, test-harness infra) get general "tests green + deployed" criteria.

### Data flow convention
As codified in `.claude/CLAUDE.md`: `data-ops query → server function → useMutation hook`, extended here with: `… → DO RPC → alarm()` for scheduled operations.

### Technology constraints (explicit from discovery)
- Cloudflare Workers as runtime (WorkerEntrypoint, Hono, Queues, KV, Cron, Durable Objects).
- TanStack Start on the frontend, React 19, Tailwind v4, Shadcn UI.
- Drizzle ORM + Neon Postgres.
- Better Auth.
- pnpm monorepo.
- vitest + `@cloudflare/vitest-pool-workers` for tests.

### Related design docs
- `/docs/saas-on-cf-delta.md` — audit delta report (generated by background agent, referenced as issue #1 in M1).
- Historical context: `/docs/003-notification-service.md` (old notification service, to be refactored in M2), `/docs/009-email-password-authentication.md` (auth reference), `/docs/IMPLEMENTATION_NOTES.md` (lessons learned).

## Validation Strategy

### Validation for deep modules (hard criteria)

#### 1. `data-ops` package

**Done when:**
- [ ] Schema has `households`, `household_members`, `notification_sources`, `channels` tables. No tenant-related tables remain.
- [ ] Migration applies cleanly on fresh DB and inserts the single household seed row.
- [ ] All tenant-related columns, indexes, and foreign keys are removed (verified by schema diff against prior state).
- [ ] Zod schemas exist for every table and match drizzle types (compile-time and runtime verification).
- [ ] Typed query layer covers: `getHousehold`, `listMembers`, `upsertMember`, `listChannels`, `upsertChannel`, `listNotificationSources`, `upsertNotificationSource`, `getNotificationSourceById`.
- [ ] Integration tests pass on PGLite (local) AND on Neon branch (CI). Both profiles wired in vitest config.
- [ ] No drizzle imports exist outside the `data-ops` package (verified by linter rule or grep check in CI).
- [ ] `pnpm build:data-ops` succeeds and outputs typed consumer entry points.

#### 2. `domain/notification` module

**Done when:**
- [ ] Pure module with zero I/O and zero dependencies beyond `data-ops` types and `zod`.
- [ ] Exports: `NotificationSource` type, `NotificationPayload` type, `scheduleFor(source, now) → nextRunAt | null`, `render(source, context) → NotificationPayload`.
- [ ] 100% unit test coverage of exported functions (verified by vitest coverage report).
- [ ] All tests written test-first (verified by git history showing failing test → implementation → passing test cadence).
- [ ] No imports from channel adapters, DO runtime, or any app code (verified by import graph check).
- [ ] Interface is documented with JSDoc on all exports.

#### 3. `NotificationChannel` port + adapters

**Done when:**
- [ ] Port interface defined: `Channel.send(payload: NotificationPayload): Promise<DeliveryResult>` with explicit error types.
- [ ] `TelegramChannel` stub adapter exists, type-checks against port, throws `NotImplemented` on `send()` call, has tests asserting the throw.
- [ ] `SerwerSMSChannel` adapter exists, wraps existing SerwerSMS code, gated by `FEATURE_SMS_ENABLED` env var. When flag is `false`, the adapter throws `FeatureDisabled`. When `true`, it proxies to the existing client.
- [ ] `NoopChannel` adapter exists in `test-harness`, records invocations in an in-memory list, resettable per test.
- [ ] Contract test suite exists that every adapter passes: interface shape, error taxonomy, idempotency of `send` (calling twice with same payload produces two deliveries or one idempotent delivery — behavior defined explicitly).
- [ ] No code outside adapters references specific channel implementations (domain uses port only).

#### 4. `SchedulerDO` scaffold

**Done when:**
- [ ] `SchedulerDO` class exists, bound to a Durable Object namespace in `wrangler.jsonc`.
- [ ] RPC surface implemented: `updateSchedule(config)`, `triggerNow()`, `getState()`.
- [ ] `alarm()` handler is present but delegates to a `scheduleFor` call from `domain/notification` and a `Channel.send` call from the port. DO owns no business logic.
- [ ] DB is the source of truth: on `updateSchedule`, the DO reads config from DB (passed via RPC payload that includes the source id), recomputes next alarm, and stores only the alarm timestamp in DO storage.
- [ ] Tests using `@cloudflare/vitest-pool-workers` cover: creating a DO, calling `updateSchedule`, asserting `alarm()` fires at expected time (with test clock), calling `triggerNow`, asserting `Channel.send` is invoked with `NoopChannel`.
- [ ] DO does NOT import drizzle or channel implementations directly — only ports and data-ops queries.

### Validation for shallow modules (general criteria)

- **Better Auth facade:** tests exercising `getCurrentUser`, `requireHouseholdAdmin`, `listMembers`; stale tenant-related columns removed from auth schema; manual smoke test of login flow on stage.
- **`test-harness` module:** used by every package's tests; `createTestDb()` returns working PGLite or Neon branch connection based on profile; `mockChannel()` returns a `NoopChannel`.
- **`apps/user-application`:** builds, deploys to stage, deploys to prod, manual smoke test of login and member CRUD.
- **`apps/data-service`:** builds, deploys to stage, deploys to prod, DO namespace is live in prod.
- **CI/CD:** `main` is protected with required status check `test:ci`; PRs cannot merge without green run; stage deploys automatically on merge; prod deploys require manual approval.

### Overall M1 acceptance

M1 is DONE when:
1. All issues in the milestone are closed.
2. `main` is green on CI.
3. Stage environment has the new schema with seed household and runs the refactored app.
4. Prod environment has the new schema with seed household and runs the refactored app.
5. `docs/m1-retro.md` is written and captures what should flow back into `saas-on-cf` template.
6. `docs/saas-on-cf-delta.md` is committed and referenced from issue #1.
7. No tenant-related code, tables, or env vars remain anywhere in the repo (verified by grep audit).

## Out of Scope

**Explicitly NOT in M1:**
- **Working Telegram delivery.** Only the stub adapter and the port exist. Real `sendMessage` to Telegram Bot API is M2.
- **Working notification dispatch end-to-end.** `SchedulerDO` has RPC surface and `alarm()` but does not yet drive real notifications for the family. M2.
- **New notification source types.** Only the table and the handler contract. First real source (waste collection port) is M2.
- **Birthday reminders, weather alerts, any new feature domains.** These are M2+ once the framework exists.
- **UI for managing notification sources.** M2.
- **Landing page, lead capture form, portfolio content.** M3.
- **Payment integration changes.** `docs/010-payments.md` remains as-is; not touched in M1.
- **i18n / multilingual refactor.** Existing pl/en stays as-is unless the `saas-on-cf` audit explicitly flags it as blocking.
- **Mobile app, PWA, push notifications.** Not in any planned milestone.
- **Multi-household support.** Deferred. M1 only lays the schema groundwork (jawna encja z jednym seed row) so that a future pivot is cheap. No multi-household UI, no creation flow.
- **Webhook-based Telegram (two-way bot).** Discovery explicitly chose one-way. Any command handling is deferred beyond M3.
- **Feature flags table.** Single `FEATURE_SMS_ENABLED` env var is the whole system for now. Refactor to DB-backed flags deferred until a second flag appears.
- **Observability beyond what `saas-on-cf` template provides.** If the audit finds structured logs + error tracking, we port them. If not, minimum viable logging only — we do not invent new observability in M1.

## Further Notes

### Discovery artifacts
This PRD is the output of `/ask:ask` and `/blueprint:blueprint` sessions conducted on 2026-04-09. The discovery resolved 14 questions across product positioning, architecture, testing, and delivery strategy. Full transcript is in the Claude Code session history.

### Parallel work
While this PRD was being drafted, a background agent was executing the `saas-on-cf` audit and producing `docs/saas-on-cf-delta.md`. The audit is issue #1 of M1 and is the reference for issues #3 onward (structure alignment, pattern portings). Issue #2 (test harness bootstrap) starts independently because the pyramid strategy is already decided.

### Next step in the planning chain
After this PRD lands: run `/carve:carve` to break M1 into vertical-slice phases (or run `/dispatch:dispatch` directly to convert into GitHub issues tagged with the M1 milestone).

### Connection to subsequent milestones
- **M2 Personal Notification Hub** will fill in the stubs: real `TelegramChannel.send`, real `SchedulerDO.alarm()` logic, first real `notification_source` (waste collection port from old system), UI for managing sources and household members, second real source (birthdays) to prove the model is generic.
- **M3 Landing + Lead Capture** will add public landing page, lead form, and dogfood a `notification_source` that notifies the owner via the hub when a new lead arrives.

### Lessons flowing back to template
Whatever is learned in M1 about deep modules, test harness ergonomics, DO testing patterns, and Neon branch CI should be considered for back-porting to `saas-on-cf` itself. The retro in `docs/m1-retro.md` captures this explicitly as action items for the template repo.

### Open questions intentionally NOT resolved in this PRD
None at time of writing. All four blueprint-phase open questions (B1–B4) were answered during the interview:
- B1 (test DB) → hybrid PGLite local + Neon branch CI.
- B2 (household) → explicit entity with single seed row.
- B3 (SMS flag) → env var now, refactor to feature flags table later.
- B4 (M1 gating on audit) → soft gate, test harness starts in parallel.

Any further unknowns surface as questions in individual GitHub issues during execution.
