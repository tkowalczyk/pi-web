# PRD — M2 Personal Notification Hub

**Milestone:** M2 Personal Notification Hub
**Status:** FULL PRD — gotowe do `/carve`
**Data:** 2026-04-11
**Poprzednik:** `docs/prd-m1-fundament.md` (zamknięty, retro w `docs/m1-retro.md`)
**Tracking issue:** [#10](https://github.com/tkowalczyk/pi-web/issues/10)

---

## Problem Statement

Po zamknięciu M1 `pi-web` ma czysty fundament — model domeny, abstrakcje (`NotificationChannel` port, `SchedulerDO` scaffold), test harness, CI/CD — ale **zero realnej wartości dla użytkownika końcowego**. Rodzina (3-5 osób) nie dostaje żadnych powiadomień z systemu. `TelegramChannel` jest stubem rzucającym „not implemented". Durable Object nie dispatcha. UI nie pozwala zarządzać źródłami powiadomień.

M2 ożywia fundament: działające powiadomienia end-to-end na Telegramie z topikami grupowymi, dwa typy źródeł (wywóz odpadów + urodziny) dowodzące generyczności frameworku, admin UI do zarządzania, i delivery observability z self-alertem.

## Solution

System wysyła one-way powiadomienia z Cloudflare Worker do rodzinnej grupy Telegram z forum topics. Każde źródło powiadomień (`notification_source`) ma swój topic tworzony automatycznie przez bota, inline konfigurację w JSON, i dedykowany `SchedulerDO` zarządzający alarmami. Wiadomości renderowane w HTML z emoji per typ źródła. Admin (właściciel) zarządza wszystkim przez web UI (TanStack Start + TanStack Form + Shadcn). System monitoruje sam siebie — cron sprawdza delivery failures i alarmuje przez własny hub na topic „System".

### Kluczowe elementy rozwiązania

- **TelegramChannel** — pełna implementacja portu `NotificationChannel`. Worker → Telegram Bot API (`sendMessage` z `message_thread_id` i `parse_mode: HTML`). Retry 3x z exponential backoff, dead letter po wyczerpaniu prób.
- **SchedulerDO ożywiony** — `alarm()` dispatcha realnie: czyta config z DB → handler renderuje payload → kanał wysyła. RPC `updateSchedule` / `triggerNow` / `getState` działają z UI.
- **Waste collection source** — pierwszy realny typ. Inline config z adresem i harmonogramem dat. Stare tabele cities/streets/schedules usunięte (DROP migration). `alertBeforeHours` konfigurowalny, domyślnie 18h.
- **Birthday source** — drugi typ, dowód generyczności. Config z listą `{ name, date }`. Proste przypomnienie „🎂 Dziś urodziny X". `alertBeforeHours` domyślnie 24h.
- **Admin UI** — CRUD notification sources (auto-tworzenie topicu), household members, delivery log viewer, household settings (timezone).
- **Delivery observability** — `delivery_log` tabela (każde wysłanie), `delivery_failures` dead letter (po 3 retry), cron self-alert na TG topic „System".

## User Stories

### Telegram delivery

1. As the household admin, I want the system to send notification messages to a Telegram group with forum topics, so that my family receives reminders in organized threads.
2. As the household admin, I want the bot to automatically create a new forum topic when I add a notification source, so that I don't have to manually copy topic IDs.
3. As the household admin, I want messages formatted in HTML with emoji per source type (🗑 waste, 🎂 birthday), so that notifications are easy to scan on mobile.
4. As the household admin, I want failed deliveries to retry 3 times with exponential backoff before being recorded as failures, so that transient Telegram API errors don't cause missed notifications.
5. As the household admin, I want each delivery attempt (success or failure) logged to a `delivery_log` table, so that I have full visibility into what was sent and when.
6. As the household admin, I want permanently failed deliveries written to a `delivery_failures` dead letter table, so that I can see what notifications my family missed.

### Waste collection source

7. As the household admin, I want to create a waste collection notification source with my address and a schedule of collection dates per waste type, so that the family gets reminded before each pickup.
8. As the household admin, I want to configure `alertBeforeHours` (default 18h) per source, so that the reminder arrives the evening before pickup.
9. As the household admin, I want waste collection messages formatted as `🗑 <b>Jutro wywóz: {type}</b>\n{address}\n📅 {date}`, so that the information is immediately clear.
10. As the household admin, I want the waste collection config stored as inline JSON (`{ address, schedule: [{ type, dates }] }`), so that the system doesn't depend on legacy city/street tables.

### Birthday source

11. As the household admin, I want to create a birthday notification source with a list of names and dates, so that the family gets reminded about upcoming birthdays.
12. As the household admin, I want birthday data stored in the source config JSON (`{ birthdays: [{ name, date }] }`), so that I can track birthdays of people outside the household (friends, extended family).
13. As the household admin, I want birthday messages formatted as `🎂 <b>Dziś urodziny: {name}</b>\nPamiętaj o życzeniach!`, so that the reminder is simple and actionable.
14. As the household admin, I want `alertBeforeHours` for birthdays to default to 24h, so that I have time to prepare a gift or message.

### SchedulerDO

15. As the household admin, I want each notification source to have its own Durable Object that manages scheduling, so that sources are isolated and independently schedulable.
16. As the household admin, I want the DO to read schedule configuration from the database (source of truth) and compute the next alarm time using the domain module, so that schedule changes take effect immediately.
17. As the household admin, I want to trigger a notification source immediately via the UI (`triggerNow` RPC), so that I can test that delivery works without waiting for the next scheduled alarm.
18. As the household admin, I want to see the current state of a scheduler (next alarm time, last fired, status) in the UI, so that I know the system is working.

### Admin UI

19. As the household admin, I want a CRUD interface for notification sources (create, edit config/schedule, delete), so that I can manage all my family's notification sources from one place.
20. As the household admin, I want creating a new source to automatically create its Telegram topic and wire up the SchedulerDO, so that setup is a single action.
21. As the household admin, I want a list of household members with the ability to add/remove members, so that I can manage who is part of the household.
22. As the household admin, I want a delivery log viewer showing the last N deliveries with status, timestamp, and error details, so that I can debug delivery issues.
23. As the household admin, I want to configure the household timezone (default `Europe/Warsaw`), so that `alertBeforeHours` is computed relative to local time.
24. As the household admin, I want forms built with TanStack Form and validated with Zod, so that the UI is type-safe and consistent with the backend validation.

### Delivery observability & self-alert

25. As the household admin, I want a cron job running hourly that checks `delivery_failures` from the last hour, so that the system detects delivery problems automatically.
26. As the household admin, I want the cron self-alert to send a notification to a dedicated „⚠️ System" topic in Telegram when failures exceed a threshold, so that I'm notified through the same channel I'm already watching.
27. As the household admin, I want the self-alert to use the same `NotificationChannel` port and `TelegramChannel` adapter, so that the monitoring dogfoods the delivery infrastructure.

### Schema cleanup

28. As a developer, I want legacy tables (cities, streets, waste_schedules) dropped via migration, so that the codebase has no SaaS-era data model remnants.
29. As a developer, I want the `households` table to have a `timezone` column (default `Europe/Warsaw`), so that scheduling can be timezone-aware.
30. As a developer, I want a `delivery_log` table tracking every send attempt, so that observability has a persistent data source.

### M3 forward-compatibility

31. As a developer building M3, I want the `NotificationChannel.send()` interface to be trigger-agnostic (works for scheduled alarms and HTTP-triggered events), so that M3's lead notification source can reuse the same delivery path.
32. As a developer building M3, I want the handler pattern (`renderMessage(source, config) → NotificationPayload`) to work for event-driven sources (not just scheduled), so that M3 adds a handler without changing the framework.

## Implementation Decisions

### Architecture (carried from M1, not re-negotiable)

- **One-way Telegram bot** — Worker → Telegram Bot API, no webhook. Family reads in TG; system does not listen back.
- **`SchedulerDO` per notification source** — not a singleton scheduler. Each source has its own DO instance.
- **DB as source of truth** — schedule config lives in Neon. DO reads it via data-ops RPC, stores only next alarm timestamp in DO storage.
- **`NotificationChannel` port + adapters** — narrow `send()` interface with explicit error taxonomy.
- **Data flow:** `UI → mutation → data-ops → DO RPC → alarm() → handler → channel → TG`
- **Full test pyramid, strict TDD** — red-green-refactor, test-first commits visible in git history.

### M2-specific decisions

| Area | Decision | Rationale |
|---|---|---|
| TG fallback | No DM fallback — topic-only delivery | 3-5 person household, adding to group is 30 seconds |
| Message format | HTML (`parse_mode: "HTML"`) + emoji per source type | Simpler escaping than MarkdownV2, native TG support |
| Retry policy | 3 attempts, exponential backoff (1s → 4s → 16s), then dead letter | Sufficient at 5-10 msg/day volume |
| Idempotency | None — duplicate on retry acceptable at this scale | Engineering overhead not justified by volume |
| Topic management | Bot creates topics via `createForumTopic` automatically | Zero manual ID copying, bot needs `can_manage_topics` permission |
| Waste data model | Inline `config` JSON, DROP legacy cities/streets tables | Personal hub ≠ SaaS serving 100 cities; config JSON pattern reused by all source types |
| Targeting | Household-level — one topic per source, all members see it | Consistent with no-DM-fallback decision |
| Alert window | `alertBeforeHours` in source config, defaults per type (waste: 18h, birthday: 24h) | Unified mechanism across source types, proves framework genericity |
| Birthday data | In source `config` JSON, not in `household_members` | Separates auth/membership domain from notification data domain |
| Birthday behavior | Simple reminder, no LLM, no send button | Preserves one-way architecture |
| Timezone | Per household (`Europe/Warsaw`), `Temporal` API in Workers | Single household = single timezone; Temporal handles DST natively |
| Alarm resilience | Cloudflare at-least-once guarantee sufficient, no cron fallback | CF guarantees alarm retry after incidents; cron fallback adds untested code path |
| Schedule edit during alarm | Simple overwrite — DO is single-threaded, natural serialization | No locking needed; DO reads fresh config after each alarm |
| Forms | TanStack Form | Investment in TanStack ecosystem consistency |
| UI permissions | Admin-only — members see notifications in TG, don't need app access | 1 admin household, members consume via TG |
| Layout | Desktop-first, Shadcn responsive out of the box | UI is setup tool; TG is the daily mobile interface |
| Delivery metrics | `delivery_log` table in Neon | Already have DB, queryable, joinable, supports UI viewer |
| Self-alert | Cron hourly → query failures → TG „System" topic | Dogfoods own hub; elegant self-monitoring |
| Message templates | Hardcoded per handler (`renderMessage()`) | 2 source types, predictable format, change = redeploy |
| M3 compatibility | Same handler pattern for event-driven sources | `renderMessage()` is trigger-agnostic; M3 lead handler reuses pattern |

### Key data flows

**Scheduled notification (waste / birthday):**
```
SchedulerDO.alarm()
  → data-ops.getNotificationSource(id)
  → handler.renderMessage(source, config)
  → TelegramChannel.send(payload, topic_id)
    → retry up to 3x on failure
    → INSERT delivery_log (success or final failure)
    → INSERT delivery_failures (if all retries exhausted)
  → domain.computeNextAlarm(config, timezone)
  → DO.storage.setAlarm(nextAlarmTime)
```

**Source creation (UI):**
```
Admin creates source in UI
  → TanStack Form validates with Zod
  → server function → data-ops.createNotificationSource()
  → TelegramChannel.createForumTopic(name, emoji)
  → data-ops.updateSource({ topic_id })
  → SchedulerDO.updateSchedule(source_id)
  → DO reads config, computes first alarm, sets alarm
```

**Self-alert (cron):**
```
Cron trigger (hourly)
  → data-ops.countRecentFailures(1h)
  → if count > threshold:
    → TelegramChannel.send(alertPayload, systemTopicId)
```

### System boundaries

- **Telegram Bot API** — outbound only. Bot needs: `sendMessage`, `createForumTopic`. Permissions: `can_manage_topics` in group.
- **Neon Postgres** — source of truth for config, delivery logs, schedule state. Accessed exclusively via `data-ops`.
- **Cloudflare Workers** — runtime for all server-side code. Durable Objects for per-source scheduling.
- **TanStack Start** — SSR frontend. Server functions call `data-ops` and DO RPC.

## Validation Strategy

### TelegramChannel adapter
- Contract test suite from M1 passes with real implementation (not just stub)
- Integration test: `send()` → mock TG API → assert correct HTTP request (method, body, headers)
- Integration test: `send()` → mock TG API returning 429 → assert 3 retries with backoff timing
- Integration test: `send()` → 3 consecutive failures → assert `delivery_failures` row created
- Integration test: `createForumTopic()` → mock TG API → assert topic created with correct name/emoji
- Every `send()` call produces a `delivery_log` row regardless of outcome

### Domain handlers
- Unit test: `WasteCollectionHandler.renderMessage()` returns valid HTML with emoji for each waste type
- Unit test: `BirthdayHandler.renderMessage()` returns valid HTML with name and emoji
- Unit test: `computeNextAlarm()` for waste — given schedule dates and `alertBeforeHours`, returns correct UTC timestamp accounting for timezone
- Unit test: `computeNextAlarm()` for birthday — same mechanism, different defaults
- Unit test: DST transition — alarm time shifts correctly when clocks change
- 100% unit test coverage for domain handlers (pure functions, no I/O)

### SchedulerDO
- Cloudflare vitest pool test: create DO → `updateSchedule()` → assert alarm set at expected time
- Cloudflare vitest pool test: advance test clock → `alarm()` fires → assert `NoopChannel` recorded delivery
- Cloudflare vitest pool test: `triggerNow()` → assert immediate delivery without changing next scheduled alarm
- Cloudflare vitest pool test: `getState()` returns `{ nextAlarm, lastFired, status }`
- Cloudflare vitest pool test: `alarm()` fires → next alarm auto-scheduled for next event in config
- Cloudflare vitest pool test: `updateSchedule()` during alarm execution → next alarm uses updated config

### Admin UI
- Notification source CRUD: create source → assert topic created + DO scheduled + source in DB
- Notification source CRUD: edit config → assert DO rescheduled
- Notification source CRUD: delete source → assert DO destroyed + source removed from DB
- Household members: add/remove member → assert DB state
- Delivery log viewer: assert renders last N deliveries with correct status indicators
- Household settings: change timezone → assert sources rescheduled
- All forms validate with Zod; invalid input shows inline errors via TanStack Form

### Delivery observability
- Integration test: cron trigger → N failures in last hour > threshold → `NoopChannel` records self-alert
- Integration test: cron trigger → N failures in last hour ≤ threshold → no alert sent
- `delivery_log` rows queryable by source, channel, status, date range

### Schema migrations
- Migration drops legacy tables (cities, streets, waste_schedules) cleanly on fresh and existing databases
- `households.timezone` column exists with default `Europe/Warsaw`
- `delivery_log` table exists with expected columns
- `notification_sources.config` is JSONB and accepts both waste and birthday config shapes
- All existing M1 tests pass after migration

### End-to-end
- Full vertical slice: create waste source via UI → DO schedules alarm → advance time → alarm fires → TG API receives correctly formatted HTML message → `delivery_log` records success
- Full vertical slice: create birthday source → same flow → different message format
- Self-alert: inject delivery failures → cron fires → TG API receives system alert

### M3 forward-compatibility
- `NotificationChannel.send()` accepts payloads from both scheduled and event-driven sources (demonstrated by test with synthetic event-driven payload)
- Handler pattern works without `SchedulerDO` involvement (direct handler → channel call succeeds)

## Out of Scope

- **Two-way bot** — no webhook, no commands, no InlineKeyboard callbacks
- **DM fallback** — no per-member direct messages
- **Push notifications** (APNs/FCM)
- **Mobile app / PWA**
- **LLM-generated content** (birthday wishes, smart summaries)
- **Custom notification sources** beyond waste collection and birthdays
- **External calendar integration** (Google Calendar, iCal)
- **Multi-household** — single household, M1's schema door remains unused
- **SMS delivery** — `SerwerSMSChannel` adapter exists behind feature flag, M2 does not activate it
- **Idempotency keys** — acceptable duplicate risk at current volume
- **Cron alarm fallback** — Cloudflare at-least-once guarantee sufficient
- **Template engine for messages** — hardcoded per handler, no user-customizable templates
- **Per-member timezone or targeting** — household-level only
- **External monitoring** (UptimeRobot, Sentry) — self-alert through own hub

## Further Notes

### Relationship to M1

M2 builds directly on M1's foundation:
- `NotificationChannel` port → `TelegramChannel` gets real implementation
- `SchedulerDO` scaffold → real dispatch logic
- `NoopChannel` → continues to serve as test double
- Contract test suite → `TelegramChannel` must pass it
- Domain module → handlers added, module stays pure (zero I/O)
- `delivery_failures` table from retry policy reuses M1's error taxonomy

### M1 retro lessons applied

- **Test clock pattern**: M1 retro noted `@cloudflare/vitest-pool-workers` documentation gaps for DO testing. M2 builds on patterns discovered in M1-P7 — document any new findings.
- **PGLite vs Neon**: M1 found one JSON column default divergence. M2 adds JSONB `config` column and `delivery_log` — watch for new divergences.
- **Migration propagation**: M1 retro identified friction in generating same migration 3x (dev/stage/prod). If the propagation script was built, use it; if not, accept the friction for M2.

### M3 preparation

M3 (Landing + Lead Capture) dogfoods M2's notification framework:
- New `LeadNotificationHandler` with `renderMessage()` — same pattern as waste/birthday
- HTTP trigger (form submit) instead of scheduled alarm — `NotificationChannel.send()` is trigger-agnostic
- New TG topic „📩 Leads" — created by same `createForumTopic` mechanism
- M3 is the ultimate test of M2's genericity. If M3 requires changes to the port, DO, or domain module, those changes feed back into M2 retro.

### Telegram bot setup (HITL prerequisite)

Before M2 implementation begins, admin must:
1. Create a Telegram bot via @BotFather
2. Create a Telegram group with forum topics enabled
3. Add bot to group with `can_manage_topics` permission
4. Store `TELEGRAM_BOT_TOKEN` and `TELEGRAM_GROUP_CHAT_ID` as wrangler secrets
5. Verify bot can send a test message to the group

### Next step

1. `/carve` → tracer-bullet phases in `plans/m2-notification-hub.md`
2. `/dispatch` → GitHub issues under milestone M2
