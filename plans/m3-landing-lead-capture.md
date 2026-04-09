# Plan: M3 Landing + Lead Capture (STUB)

> **Status: STUB — not yet carved.** This placeholder exists for structural consistency with `plans/m1-fundament.md`. The full tracer-bullet phases will be authored after M2 is complete.
>
> **Source PRD (stub):** [`docs/prd-m3-landing-lead-capture.md`](../docs/prd-m3-landing-lead-capture.md)
> **Tracking issue:** [#11 M3 — PRD stub (waiting for M2 retro)](https://github.com/tkowalczyk/pi-web/issues/11)
> **Blocked by:** M2 Personal Notification Hub milestone must be complete.

## Why this plan is deliberately empty

M3 is a dogfood milestone: the lead capture form triggers a new `notification_source` type that notifies the owner via the M2 hub. The moment M2 framework exists and works for the family, M3 is mostly scaffolding + new content. But its architecture depends entirely on M2 shape:

- How hard is it to add a new notification source type? (If easy → M3 is small.)
- Does the source model support HTTP trigger (not just scheduled)? (If no → M2 needs extension first.)
- What does the owner-notification flow look like in M2? (M3 reuses it for lead alerts.)
- Are there ergonomic issues with the UI from M2 that should inform landing page stack decisions?

Planning M3 phases now would guess at all of these.

## Architectural decisions (from discovery)

- Landing = lead capture + portfolio dual role.
- Form pattern mirrors `wizytowka.link` — simple field set, email OR phone, optional message.
- Single admin (owner), Better Auth handles it (same config as rest of app).
- New lead → notification to owner via M2 hub. This is dogfooding — M3 tests M2 framework.
- M3 is the last milestone. After it: wielki retro całego pivotu.

## Draft phases (placeholder — not the final plan)

Rough shape. Exact boundaries post-M2.

1. **Landing page content + i18n + portfolio section** (reuse pl/en from M1)
2. **Lead capture form — schema + endpoint + validation + anti-spam** (Turnstile or honeypot, RODO consent)
3. **Lead notification source — dogfoods M2 hub** (new `notification_source` type, handler triggers on insert)
4. **Admin panel — leads list + statuses + notes** (minimum viable CRUD)
5. **RODO compliance** — privacy policy update, consent flow, retention policy
6. **Routing finalization** — landing on root vs app on subdomain decision
7. **Stage + Prod deploy + M3 retro + pivot closeout** (wielki retro całego projektu)

## Open questions

See [`docs/prd-m3-landing-lead-capture.md`](../docs/prd-m3-landing-lead-capture.md) — 24 questions grouped into 7 areas (content, form, anti-spam, RODO, admin panel, routing, dogfood flow).

## Next step (after M2 closes)

1. Close GitHub milestone M2 and merge `docs/m2-retro.md`
2. Fresh `/ask:ask` session on M3 open questions (shorter than M1 — scope is smaller)
3. `/blueprint:blueprint` → overwrite `docs/prd-m3-landing-lead-capture.md` with full PRD
4. `/carve:carve` → overwrite this file with tracer-bullet phases
5. `/dispatch:dispatch` → create real M3 phase issues under milestone #3
6. Close tracking issue #11 once real issues are created

## After M3 closes

Write `docs/pivot-retro.md` — full retrospective of the entire three-milestone pivot. Back-port all lessons to the `saas-on-cf` template. This is the formal end of the project's restructuring phase.
