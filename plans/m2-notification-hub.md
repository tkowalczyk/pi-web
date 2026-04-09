# Plan: M2 Personal Notification Hub (STUB)

> **Status: STUB — not yet carved.** This placeholder exists for structural consistency with `plans/m1-fundament.md`. The full tracer-bullet phases will be authored after M1 is complete.
>
> **Source PRD (stub):** [`docs/prd-m2-notification-hub.md`](../docs/prd-m2-notification-hub.md)
> **Tracking issue:** [#10 M2 — PRD stub (waiting for M1 retro)](https://github.com/tkowalczyk/pi-web/issues/10)
> **Blocked by:** all M1 issues (#2–#9). Specifically, `docs/m1-retro.md` must be merged before M2 discovery can begin.

## Why this plan is deliberately empty

M2 planning depends on lessons learned during M1 execution. Key uncertainties that M1 will resolve:

- Ergonomics of `@cloudflare/vitest-pool-workers` — does the test clock pattern actually work for Durable Object tests?
- PGLite vs Neon branch fidelity — any PG dialect surprises at the dataset size M2 needs?
- `NotificationChannel` port surface — is the M1 contract sufficient for a real Telegram implementation, or will M2 need to extend it?
- `SchedulerDO` RPC design — does the update → recompute alarm → persist pattern hold up in practice?
- Deep module boundaries — does the domain/notification module actually stay pure when M2 adds real handlers?

Writing tracer-bullet phases now would bake in assumptions to all of these, and each one represents a likely revision point.

## Architectural decisions (carried forward from discovery, not re-negotiable without reason)

Durable decisions already locked in during `/ask:ask`. These will carry into the full plan when it is authored:

- One-way Telegram bot: worker → Telegram Bot API, no webhook. Family reads and comments in Telegram; system does not listen back.
- `SchedulerDO` per notification source (not a singleton scheduler).
- DB as source of truth for schedule config. DO subscribes via RPC.
- `notification_sources` as DB records + typed handlers in code.
- Ты (owner) + household members as named users, single implicit household.
- `NotificationChannel` port stays; `TelegramChannel` gets full implementation; `SerwerSMSChannel` remains disabled by feature flag.
- Full test pyramid, strict TDD.
- Data flow: `UI → mutation → data-ops → DO RPC → alarm()` — established in M1.

## Draft phases (placeholder — not the final plan)

Rough shape expected after carving. Exact boundaries will be revisited post-M1.

1. **Telegram channel — real implementation** (send, error taxonomy, retry, rate limit awareness)
2. **SchedulerDO — real dispatch logic** (alarm() delegates to domain → port, test clock, idempotency)
3. **Waste collection source — port from legacy** (schema migration if needed, handler, integration with SchedulerDO)
4. **UI — household members CRUD + notification sources CRUD + schedule editor**
5. **Birthdays source** (proves framework is generic)
6. **Delivery observability** (structured logs, retry telemetry, failure notifications to owner)
7. **M2 end-to-end live for family** (stage + prod deploy, real Telegram channel with real topics, family joined)
8. **M2 retro** (back-port candidates for saas-on-cf, unblock M3)

## Open questions

See [`docs/prd-m2-notification-hub.md`](../docs/prd-m2-notification-hub.md) — 20 questions grouped into 6 areas. These are the inputs for the `/ask:ask` session that kicks off post-M1.

## Next step (after M1 closes)

1. Close GitHub milestone M1 and merge `docs/m1-retro.md`
2. Fresh `/ask:ask` session focused on M2 open questions, with M1 retro in context
3. `/blueprint:blueprint` → overwrite `docs/prd-m2-notification-hub.md` with full PRD
4. `/carve:carve` → overwrite this file with tracer-bullet phases
5. `/dispatch:dispatch` → create real M2 phase issues under milestone #2
6. Close tracking issue #10 once real issues are created
