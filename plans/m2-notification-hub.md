# Plan: M2 Personal Notification Hub

> Source PRD: [`docs/prd-m2-notification-hub.md`](../docs/prd-m2-notification-hub.md)
> M1 retro: [`docs/m1-retro.md`](../docs/m1-retro.md)
> Follow-up milestone: [`docs/prd-m3-landing-lead-capture.md`](../docs/prd-m3-landing-lead-capture.md) (stub)

## Architectural decisions

Durable decisions applied across all phases. These were locked in during M1 and confirmed during M2 `/ask:ask` — they should not re-open during execution without explicit reason.

- **Architecture style**: Cloudflare Workers monorepo (pnpm workspaces). Deep modules — narrow interfaces, thick implementations. Packages expose typed entry points; no cross-package leakage.
- **Data model shape**: Single-household domain. `notification_sources` with inline `config` JSONB and typed handlers in code. `delivery_log` and `delivery_failures` for observability. Legacy cities/streets/schedules tables dropped.
- **Key entities**: `household` (with `timezone`), `household_member`, `channel`, `notification_source` (with `config` JSONB), `delivery_log`, `delivery_failures`.
- **Telegram integration**: One-way bot. Worker → Telegram Bot API (`sendMessage` with `message_thread_id`, `parse_mode: HTML`). Bot creates forum topics via `createForumTopic`. No webhook, no commands, no callbacks.
- **Scheduling**: `SchedulerDO` per notification source. DB is source of truth. DO reads config via data-ops RPC, computes next alarm with domain module using `alertBeforeHours` + household timezone, stores only alarm timestamp in DO storage.
- **Delivery**: `NotificationChannel` port with `TelegramChannel` adapter. Retry 3x exponential backoff. Dead letter after exhaustion. Every attempt logged to `delivery_log`. No idempotency keys.
- **Message format**: HTML + emoji per source type. Hardcoded templates in handlers (`renderMessage()`). Trigger-agnostic — same pattern for scheduled and event-driven sources (M3 compatibility).
- **UI**: TanStack Form + Shadcn UI. Admin-only. Desktop-first with Shadcn responsive.
- **Testing**: Full pyramid, strict TDD. Contract tests for channel adapters. Cloudflare vitest pool for DO. PGLite local + Neon branch CI.
- **Timezone**: Per household (`Europe/Warsaw`), `Temporal` API in Workers for DST-safe computation.

---

## Phase 1: TelegramChannel — real delivery

**User stories**: 1, 3, 4, 5, 6, 30

### What to build

Replace the M1 `TelegramChannel` stub with a full implementation of the `NotificationChannel` port. The adapter wraps the Telegram Bot API `sendMessage` endpoint, sending HTML-formatted messages with `message_thread_id` for forum topic routing. Implement retry logic: 3 attempts with exponential backoff (1s → 4s → 16s). After all retries are exhausted, write the failure to a `delivery_failures` dead letter table. Every send attempt (success or failure) is recorded in a new `delivery_log` table. The M1 contract test suite must pass against the real implementation, not just the stub. Schema migration adds `delivery_log` and `delivery_failures` tables. No UI in this phase — the adapter is exercised by integration tests against a mocked Telegram Bot API HTTP endpoint.

### Acceptance criteria

- [ ] `TelegramChannel` implements `NotificationChannel` port and passes the full M1 contract test suite
- [ ] `send()` calls Telegram Bot API `sendMessage` with `parse_mode: "HTML"` and `message_thread_id`
- [ ] On transient failure (HTTP 429, 5xx), adapter retries up to 3 times with exponential backoff (1s → 4s → 16s)
- [ ] After 3 failed attempts, a row is written to `delivery_failures` with error details
- [ ] Every `send()` attempt (success or final failure) produces a row in `delivery_log` with source_id, channel, status, error, retry_count, timestamp
- [ ] Schema migration adds `delivery_log` and `delivery_failures` tables, applies cleanly on fresh and existing databases
- [ ] Integration tests cover: successful send, retry on 429, retry on 5xx, dead letter after exhaustion
- [ ] All M1 tests continue to pass
- [ ] Git history shows test-first commits
- [ ] CI green

---

## Phase 2: Waste collection — first live source

**User stories**: 7, 8, 9, 10, 15, 16, 28, 29

### What to build

Deliver the first real vertical slice of notification value: a waste collection source that fires through the full pipeline. Define the `WasteCollectionHandler` as a pure domain function that reads inline config JSON (`{ address, schedule: [{ type, dates }] }`) and renders an HTML message with emoji (🗑). Implement `computeNextAlarm()` in the domain module — given a schedule of dates, `alertBeforeHours` (default 18h), and household timezone (`Europe/Warsaw` via `Temporal`), it returns the next UTC alarm timestamp, handling DST transitions correctly. Bring the `SchedulerDO` scaffold from M1 to life: `alarm()` reads source config from DB via data-ops, delegates to the handler for rendering, dispatches through `TelegramChannel`, then computes and sets the next alarm. Run a schema migration that drops legacy tables (cities, streets, waste_schedules) and adds `timezone` column to `households` (default `Europe/Warsaw`). The slice is demoable: a DO alarm fires, handler renders waste HTML, channel sends to mock TG API, `delivery_log` records success, next alarm is set.

### Acceptance criteria

- [ ] `WasteCollectionHandler.renderMessage()` produces HTML with emoji for each waste type (e.g. `🗑 <b>Jutro wywóz: szkło</b>\nul. Kwiatowa 5\n📅 15 kwietnia 2026`)
- [ ] Handler is a pure function with zero I/O — only data-ops types and zod as dependencies
- [ ] `computeNextAlarm()` correctly computes next alarm from schedule dates, `alertBeforeHours`, and timezone
- [ ] `computeNextAlarm()` handles DST transitions (spring forward / fall back) correctly, verified by unit test
- [ ] `SchedulerDO.alarm()` executes full pipeline: read config → render → send → compute next → set alarm
- [ ] `SchedulerDO.updateSchedule()` reads fresh config from DB and recomputes alarm
- [ ] Schema migration drops `cities`, `streets`, `waste_schedules` tables
- [ ] Schema migration adds `timezone` column to `households` with default `Europe/Warsaw`
- [ ] `notification_sources.config` accepts waste collection config shape (validated by zod)
- [ ] Cloudflare vitest pool tests cover: alarm fire → delivery → next alarm set, using test clock and NoopChannel
- [ ] Integration test covers full slice with mock TG API
- [ ] Unit tests for handler and `computeNextAlarm()` at 100% coverage
- [ ] All M1 tests and Phase 1 tests pass
- [ ] Git history shows test-first commits
- [ ] CI green

---

## Phase 3: Topic auto-creation + triggerNow

**User stories**: 2, 17, 18, 20

### What to build

Complete the source lifecycle by adding automatic topic creation and manual trigger capability. When a notification source is created, the system calls `createForumTopic` on the Telegram Bot API to create a dedicated forum topic (name and emoji derived from source type), then stores the returned `message_thread_id` in the source record. The `SchedulerDO` gains two new RPC methods: `triggerNow` (dispatches immediately without changing the next scheduled alarm) and `getState` (returns `{ nextAlarm, lastFired, status }`). The end-to-end flow is demoable: create a source → topic appears in TG group → trigger now → message appears in that topic → `getState` reflects the delivery.

### Acceptance criteria

- [ ] `TelegramChannel.createForumTopic(name, emoji)` calls Telegram Bot API and returns the `message_thread_id`
- [ ] Source creation flow: data-ops insert → topic created → source updated with `topic_id` → DO scheduled
- [ ] `SchedulerDO.triggerNow()` dispatches immediately and does not modify the next scheduled alarm
- [ ] `SchedulerDO.getState()` returns current state including next alarm time, last fired timestamp, and status
- [ ] Integration test: create source → assert TG API received `createForumTopic` call with correct name/emoji
- [ ] Cloudflare vitest pool test: `triggerNow()` → NoopChannel records delivery → next alarm unchanged
- [ ] Cloudflare vitest pool test: `getState()` returns expected shape before and after alarm fire
- [ ] All previous tests pass
- [ ] Git history shows test-first commits
- [ ] CI green

---

## Phase 4: Birthday source — framework genericity proof

**User stories**: 11, 12, 13, 14, 31, 32

### What to build

Add the second notification source type to prove the framework is generic. Define `BirthdayHandler` as a pure domain function that reads config JSON (`{ birthdays: [{ name, date }] }`) and renders an HTML message with emoji (🎂). The handler uses the same `computeNextAlarm()` mechanism with `alertBeforeHours` defaulting to 24h. The birthday source goes through the identical pipeline as waste collection: `SchedulerDO.alarm()` → handler → channel. To verify M3 forward-compatibility, add a test that calls a handler directly (without SchedulerDO involvement) and passes the result to `NotificationChannel.send()` — proving the pattern works for event-driven sources, not just scheduled alarms.

### Acceptance criteria

- [ ] `BirthdayHandler.renderMessage()` produces HTML (e.g. `🎂 <b>Dziś urodziny: Mama</b>\nPamiętaj o życzeniach!`)
- [ ] Handler is a pure function, same contract as `WasteCollectionHandler`
- [ ] Birthday config shape validated by zod: `{ birthdays: [{ name: string, date: string }] }`
- [ ] `computeNextAlarm()` works for birthday source with `alertBeforeHours` default 24h
- [ ] Full pipeline test: DO alarm → birthday handler → channel → delivery logged
- [ ] M3 forward-compatibility test: handler render → direct channel send (no DO) → success
- [ ] Adding a new source type required zero changes to `NotificationChannel`, `SchedulerDO`, or domain module core — only a new handler + config schema
- [ ] Unit tests for birthday handler at 100% coverage
- [ ] All previous tests pass
- [ ] Git history shows test-first commits
- [ ] CI green

---

## Phase 5: Admin UI — notification sources CRUD

**User stories**: 19, 20, 24

### What to build

Build the admin interface for managing notification sources. Using TanStack Form with Zod validation and Shadcn UI components, create forms for: creating a new source (select type → fill config → submit → topic auto-created + DO scheduled), editing an existing source (change config/schedule → DO rescheduled), and deleting a source (confirm → DO destroyed + source removed). The create flow triggers the full Phase 3 pipeline (topic creation + DO wiring). Source list view shows all sources with their type, status, next alarm, and last delivery. Forms are validated client-side and server-side with shared Zod schemas from data-ops.

### Acceptance criteria

- [ ] Source list view displays all notification sources with type icon, name, next alarm time, last delivery status
- [ ] Create source form: type selector, dynamic config fields per type (waste: address + schedule, birthday: name/date list), `alertBeforeHours` with type-specific defaults
- [ ] Create flow: form submit → server function → data-ops insert → topic created → DO scheduled → redirect to source list
- [ ] Edit source form: pre-filled with current config, submit → data-ops update → DO rescheduled
- [ ] Delete source: confirmation dialog → data-ops delete → DO destroyed → removed from list
- [ ] All forms use TanStack Form with Zod validation; invalid input shows inline errors
- [ ] Server-side validation rejects invalid config shapes
- [ ] Desktop-first layout with Shadcn responsive components
- [ ] All previous tests pass
- [ ] CI green

---

## Phase 6: Admin UI — members + settings

**User stories**: 21, 23

### What to build

Add household member management and settings to the admin UI. Members list shows current household members with the ability to add new members (name, email, optional role) and remove existing ones. Household settings page allows the admin to view and change the household timezone — changing timezone triggers rescheduling of all active notification sources (each source's DO gets an `updateSchedule` RPC call). Both views use TanStack Form with Zod validation.

### Acceptance criteria

- [ ] Members list displays all household members with name, email, role
- [ ] Add member form: name, email, role (admin/member) — validated with Zod, submitted via server function
- [ ] Remove member: confirmation dialog → data-ops delete → removed from list
- [ ] Settings page: displays current household timezone
- [ ] Timezone change: select from common timezones → server function updates `households.timezone` → all active sources rescheduled (DO `updateSchedule` RPC per source)
- [ ] All forms use TanStack Form with Zod validation
- [ ] All previous tests pass
- [ ] CI green

---

## Phase 7: Delivery log viewer + self-alert

**User stories**: 22, 25, 26, 27

### What to build

Close the observability loop with two features. First, a delivery log viewer in the admin UI — a table showing the last N deliveries with columns for source name, channel, status (success/failure), error details, retry count, and timestamp. Filterable by source and status. Second, a cron-based self-alert: a scheduled trigger runs hourly, queries `delivery_failures` from the last hour, and if the count exceeds a configurable threshold, sends an alert notification to a dedicated „⚠️ System" topic in Telegram using the same `TelegramChannel` adapter. This is the purest dogfood: the notification hub monitors its own delivery health through its own delivery infrastructure.

### Acceptance criteria

- [ ] Delivery log viewer shows last N deliveries in a table with source, channel, status, error, retry count, timestamp
- [ ] Delivery log is filterable by source and by status (success/failure)
- [ ] Cron trigger runs hourly and queries `delivery_failures` from the last hour
- [ ] If failure count exceeds threshold, cron sends alert to „⚠️ System" TG topic via `TelegramChannel`
- [ ] Alert message includes failure count and affected source names
- [ ] Self-alert uses the same `NotificationChannel` port — no special delivery path
- [ ] Integration test: inject N+1 failures → cron fires → NoopChannel records system alert
- [ ] Integration test: inject N-1 failures → cron fires → no alert sent
- [ ] „⚠️ System" topic is created automatically if it doesn't exist (same `createForumTopic` mechanism)
- [ ] All previous tests pass
- [ ] Git history shows test-first commits
- [ ] CI green

---

## Phase 8: E2E live + M2 retro

**User stories**: all remaining

### What to build

Close the milestone by deploying to both live environments and verifying real end-to-end delivery. This is a HITL phase: the admin sets up the Telegram bot and group (BotFather, group with forum topics, bot permissions), configures secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_CHAT_ID`), and deploys both apps to stage. Verify on stage: create a waste source → topic appears → trigger now → real message in real TG group. Create a birthday source → same verification. Wait for a scheduled alarm to fire naturally. Check `delivery_log` in UI. Trigger self-alert by temporarily lowering the threshold. Once stage is validated, deploy to prod. Write the retrospective `docs/m2-retro.md` documenting: what worked, what didn't, back-port candidates for `saas-on-cf`, and M3-relevant findings (especially: was adding a new source type easy? did the framework require changes?). Close GitHub milestone M2 and update M3 stub PRD with a pointer to the retro.

### Acceptance criteria

- [ ] Telegram bot created and added to family group with `can_manage_topics` permission
- [ ] `TELEGRAM_BOT_TOKEN` and `TELEGRAM_GROUP_CHAT_ID` configured as wrangler secrets in stage and prod
- [ ] Stage deployment: both apps running, new schema applied, household with timezone exists
- [ ] Stage verification: waste source created → topic auto-created → trigger now → real TG message received
- [ ] Stage verification: birthday source created → topic auto-created → trigger now → real TG message received
- [ ] Stage verification: scheduled alarm fires at expected time and delivers correctly
- [ ] Stage verification: delivery log viewer shows all test deliveries
- [ ] Stage verification: self-alert fires when failure threshold exceeded
- [ ] Production deployment: same verifications as stage
- [ ] `docs/m2-retro.md` exists with: summary, what worked, what to improve, at least 3 back-port candidates, M3-relevant findings
- [ ] GitHub milestone M2 closed, all M2 issues closed
- [ ] M3 stub PRD updated with pointer to M2 retro
