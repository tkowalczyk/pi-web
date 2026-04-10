# M1 Fundament — Retrospective

**Data:** 2026-04-10
**Milestone:** M1 Fundament
**Baseline audit:** [`docs/saas-on-cf-delta.md`](./saas-on-cf-delta.md)
**PRD:** [`docs/prd-m1-fundament.md`](./prd-m1-fundament.md)
**Plan:** [`plans/m1-fundament.md`](../plans/m1-fundament.md)

---

## Summary

M1 delivered the architectural foundation for `pi-web` post-pivot: test harness with hybrid DB profiles, CI/CD pipeline, domain model (household + members + channels + notification sources), `NotificationChannel` port with three adapters, `SchedulerDO` scaffold, and layered worker structure with observability middleware. All legacy SaaS/payment debt was purged.

The milestone was executed in 8 phases following strict TDD (red-green-refactor) with tracer-bullet vertical slices. Each phase built on the previous one's test infrastructure and was validated by CI before merge.

---

## What worked well

- **TDD discipline held throughout.** Every phase had test-first commits visible in git history. The red-green-refactor cycle caught real bugs during domain model integration (e.g. foreign key ordering in migrations, zod schema drift from drizzle types).
- **Hybrid test DB strategy (PGLite local + Neon branch CI).** Local iteration stayed fast (~2-5s for full suite). CI caught one PGLite-vs-Neon divergence early (JSON column default handling), validating the two-profile approach.
- **Repo-hygiene tests as living contracts.** Tests in `test-harness/tests/repo-hygiene.test.ts` guard structural invariants (no drizzle leakage, no payment terms, workflow files exist). These survived every phase without modification and will continue protecting M2.
- **Audit-first approach.** The `saas-on-cf-delta.md` audit (Phase 0) identified the Stripe/BLIK debt and vitest version mismatch before execution started, saving significant debugging time.
- **Contract test suite for NotificationChannel.** Writing adapter-agnostic tests against the port proved the abstraction works before any real implementation exists.

## What could improve

- **Neon ephemeral branch cleanup.** CI creates Neon branches per PR but cleanup relies on a separate GitHub Action. Occasional orphaned branches accumulated. A cron-based cleanup or branch TTL policy would help.
- **`@cloudflare/vitest-pool-workers` documentation gaps.** Testing Durable Objects with test clocks required trial-and-error beyond official docs. Patterns discovered should be documented for template consumers.
- **Migration diff between environments.** dev/stage/prod have separate migration directories — correct for safety, but generating the same migration three times is friction. A script to propagate a dev migration to stage/prod would help.

---

## Back-port candidates for `saas-on-cf` template

Concrete patterns and improvements from M1 that should be filed as issues on the `saas-on-cf` template repo. Each item has enough detail to be actionable independently.

### Back-port 1: Multi-environment migration layout

- **What:** `packages/data-ops/src/drizzle/migrations/{dev,stage,prod}/` — separate migration directories per environment, each with its own `meta/` journal.
- **Why:** The template currently has only `dev/` migrations. Real projects need environment isolation because schema drift between dev and prod is common (e.g. seed data differs, feature flags gate certain tables). Having separate directories prevents accidental prod migration from dev-only state.
- **How to adopt:** Add `drizzle:{env}:generate` and `drizzle:{env}:migrate` scripts per environment in `packages/data-ops/package.json`. Each script points to its own `out` directory via drizzle config override.
- **Complexity:** Low (script + config changes only).

### Back-port 2: Repo-hygiene test suite pattern

- **What:** A vitest test file (`test-harness/tests/repo-hygiene.test.ts`) that asserts on structural invariants: quality gate configs exist, import boundaries are enforced, legacy terms are absent, CI workflows are present.
- **Why:** These invariants are easy to break accidentally (e.g. a new package imports drizzle directly, or a grep-safe term leaks back in). Tests catch drift at PR time, not during manual review.
- **How to adopt:** Add a `repo-hygiene.test.ts` to the template's test-harness with baseline checks for: biome/knip/taze configs, workflow files, import boundary rules (drizzle inside data-ops only), and absence of known legacy terms.
- **Complexity:** Low (one test file, no runtime dependencies).

### Back-port 3: NotificationChannel port + contract test pattern

- **What:** A narrow `NotificationChannel` interface (`send(payload) → DeliveryResult`) with an explicit error taxonomy (`NotImplemented`, `FeatureDisabled`, `DeliveryFailed`, `RateLimited`), plus a contract test suite that every adapter must pass.
- **Why:** The template's example Durable Object has no delivery abstraction. Projects that add notification/messaging features re-invent this each time. Having a port + contract test pattern in the template establishes the "how to add a new channel" workflow from day one.
- **How to adopt:** Add `src/channels/` in data-service with: `port.ts` (interface), `noop-channel.ts` (test double), `contract.test.ts` (shared test suite). Document the pattern in AGENTS.md.
- **Complexity:** Medium (interface design + test suite).

### Back-port 4: i18n with pl/en and locale-aware components

- **What:** `pi-web` has a working i18next setup with Polish and English locales, including locale-aware form validation messages and auth UI. The template has no i18n.
- **Why:** Most real-world projects need at least two languages. Having the wiring in the template (provider, `useTranslation` hooks, locale JSON files, route-level language switching) removes a day of boilerplate work per project.
- **How to adopt:** Port `apps/user-application/src/locales/` structure, i18next config, and `useTranslation` usage in auth components as a reference implementation.
- **Complexity:** Medium (touches multiple components).

### Back-port 5: Password strength UX + change password flow

- **What:** `pi-web` has a password strength indicator (zxcvbn-based), real-time feedback during registration, and a change-password flow with current-password verification. Template has basic email+password with no UX polish.
- **Why:** Password UX is a universal concern. The strength indicator prevents weak passwords without arbitrary regex rules. The change-password flow is needed by every production auth system.
- **How to adopt:** Port `password-strength-indicator` component and `change-password` server function + route from pi-web.
- **Complexity:** Low-medium (isolated components).

---

## Metrics

| Metric | Value |
|---|---|
| Phases executed | 8 (P1-P8) |
| GitHub issues closed | 7 of 9 (P1-P7 + P1.5) |
| Test files added | ~15 |
| Lines of legacy code removed | ~2,000 (SaaS/payment purge) |
| New domain tables | 4 (households, household_members, channels, notification_sources) |
| Channel adapters | 3 (Telegram stub, SerwerSMS behind flag, Noop) |
| CI workflows | 3 (ci.yml, deploy-stage.yml, deploy-prod.yml) |

---

## Next steps

This retrospective formally closes M1. Remaining actions:

1. Deploy stage + prod environments (HITL — requires manual wrangler deploy + verification)
2. Close GitHub milestone M1 after successful deploys
3. Begin M2 discovery: reopen `docs/prd-m2-notification-hub.md` stub, run `/ask:ask` for open questions 1-20
