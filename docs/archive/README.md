# docs/archive/

**Historical design documents from the pre-pivot era of `powiadomienia.info`.**

## Do not read by default

These documents describe the project as it existed **before** the 2026-04-09 pivot from a multi-tenant SaaS (SMS notifications for Polish waste collection) to a personal/family notification hub (Telegram + Durable Objects + household model).

For current active design, use:

- [`../prd-m1-fundament.md`](../prd-m1-fundament.md) — M1 foundation refactor PRD (active)
- [`../prd-m2-notification-hub.md`](../prd-m2-notification-hub.md) — M2 notification hub stub
- [`../prd-m3-landing-lead-capture.md`](../prd-m3-landing-lead-capture.md) — M3 landing stub
- [`../saas-on-cf-delta.md`](../saas-on-cf-delta.md) — audit report vs reference template

## What's here and why it's preserved

Content is kept for **historical reference only**. Reasons to keep rather than delete:

- Several documents describe code that **still exists** in the repo until M1 Phase 3 (Purge SaaS debt) removes it — future sessions may need to understand the legacy before deletion
- Patterns like multilingual UI (`006`), auth UX (`009`), and waste collection logic (`003`, `005`) contain lessons that M2 may reuse or explicitly reject
- `IMPLEMENTATION_NOTES.md` documents past mistakes which remain valuable input for future work
- Payment docs (`010-*`) are preserved per M1 PRD requirement ("Historical payment design docs are moved to an archive folder with a brief note explaining the pivot")

## Contents

| File | Topic | Era |
|---|---|---|
| `001-user-profile-and-addresses.md` | User profiles + addresses | pre-pivot |
| `002-cities-streets-database.md` | Cities + streets schema | pre-pivot |
| `003-notification-service.md` | SMS notification system (cron + queues) | pre-pivot |
| `004-db-feeder.md` | Data import from files | pre-pivot |
| `005-waste-collection-schedule-component.md` | Schedule UI component | pre-pivot |
| `006-multilingual-interface.md` | i18n implementation | pre-pivot |
| `007-footer-component.md` | Footer UI | pre-pivot |
| `008-coverage-stats-cache.md` | KV caching strategy | pre-pivot |
| `009-email-password-authentication.md` | Auth implementation | pre-pivot |
| `010-00-implementation-plan.md` through `010-08-security-hardening.md` | Stripe/BLIK payment integration | pre-pivot |
| `010-payments.md` | Payment integration overview | pre-pivot |
| `011-production-deployment.md` | Production deployment notes | pre-pivot |
| `IMPLEMENTATION_NOTES.md` | Common mistakes + lessons learned | pre-pivot |

## Instruction to AI assistants

When reading this repo in future sessions, **do not consult files in this directory unless explicitly asked by the user**. Current architecture and decisions live in the parent `docs/` folder and in `plans/`.

If the user asks about legacy behavior, past decisions, or "how did this used to work", these files are the authoritative source.
