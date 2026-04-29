# Plan: M3 Landing + Lead Capture

> Source PRD: [`docs/prd-m3-landing-lead-capture.md`](../docs/prd-m3-landing-lead-capture.md)
> M2 retro: [`docs/m2-retro.md`](../docs/m2-retro.md)

## Architectural decisions

Durable decisions applied across all phases.

- **Architecture style**: Cloudflare Workers monorepo (pnpm workspaces). New public routes in `user-application` (TanStack Start). New cron trigger and handler in `data-service`. Shared schema + queries in `data-ops`.
- **Data model**: `leads` table — `id`, `email`, `status` (enum: new/contacted/interested/closed_won/closed_lost), `notes` (text, nullable), `consent_given_at`, `created_at`, `updated_at`. No foreign keys to household — leads are standalone.
- **Key entities**: `lead`.
- **Routing**: `/` is public landing for unauthenticated users; authenticated users are redirected to admin dashboard. No subdomain split — single deployment.
- **Lead notification**: `LeadNotificationHandler` follows the same `renderMessage()` pattern as M2 handlers. HTTP trigger (form submit), not scheduled alarm. No `SchedulerDO` involved — direct handler → channel call.
- **Anti-spam**: Cloudflare Turnstile only. Token verified server-side before DB write. No IP rate limiting, no honeypot.
- **TG topic**: „📩 Leads" created via same `createForumTopic` mechanism as M2 sources. Full email + timestamp in message body.
- **i18n**: pl/en from day one. Reuse existing i18n system. Admin panel Polish only.
- **RODO**: Mandatory consent checkbox on form, linked to `/privacy`. Auto-delete cron (3-month retention). Manual delete in admin panel.
- **Testing**: Unit tests for handler (pure function). Integration tests for form endpoint (Zod + Turnstile + DB write + channel call). Existing M2 contract tests must remain green.

---

## Phase 1: Schema + formularz + routing

**User stories**: 7, 8, 9, 10, 11, 12

### What to build

Lay the end-to-end skeleton: database, form, and routing. Add the `leads` table migration and data-ops queries (insert, list, update status/notes, delete). Wire the `/` route in TanStack Start to show a minimal landing skeleton (just the form area) for unauthenticated visitors; authenticated users are redirected immediately to the admin dashboard. Build the lead capture form: email field, RODO consent checkbox (required), Cloudflare Turnstile widget. The form submission server function validates input with Zod, verifies the Turnstile token server-side, inserts a `lead` row, and returns an inline thank-you confirmation. No Telegram notification yet. No landing content beyond the form. Demoable: submit the form → lead appears in DB → inline thank-you rendered.

### Acceptance criteria

- [ ] Schema migration adds `leads` table with all columns; applies cleanly on fresh and existing databases
- [ ] data-ops exposes: `insertLead`, `listLeads`, `updateLeadStatus`, `updateLeadNotes`, `deleteLead` queries with correct Zod types
- [ ] `/` renders a minimal public landing (form visible) for unauthenticated users
- [ ] Authenticated users visiting `/` are redirected to admin dashboard without rendering the landing
- [ ] Form has email field (required) and consent checkbox (required); submit button disabled until both are valid
- [ ] Invalid email format shows inline validation error; form does not submit
- [ ] Unchecked consent checkbox blocks submission with inline error
- [ ] Turnstile widget renders and its token is sent with the form payload
- [ ] Server function rejects requests with missing or invalid Turnstile token (returns 400, no DB write)
- [ ] Valid submission: lead row inserted with `status = 'new'` and `consent_given_at` populated
- [ ] Valid submission: inline thank-you message shown; form hidden after success
- [ ] All existing M2 tests pass
- [ ] CI green

---

## Phase 2: TG dogfood — lead notification

**User stories**: 18, 19, 20

### What to build

Wire the lead capture into the M2 notification framework. Implement `LeadNotificationHandler` as a pure domain function following the same `renderMessage()` contract as `WasteCollectionHandler` and `BirthdayHandler`. Message format: `📩 <b>Nowy lead</b>\n<code>{email}</code>\n📅 {timestamp}`. The „📩 Leads" Telegram topic is created automatically on first use via `createForumTopic` (same mechanism as notification sources in M2) and its `message_thread_id` stored in a config entry. The form submission server function, after inserting the lead row, calls `NotificationChannel.send()` directly (no `SchedulerDO`) with the rendered payload. Demoable: submit the form → lead in DB + TG message appears on „📩 Leads" topic.

### Acceptance criteria

- [ ] `LeadNotificationHandler.renderMessage()` returns correct HTML with email and timestamp
- [ ] Handler is a pure function with zero I/O — passes same contract interface as M2 handlers
- [ ] „📩 Leads" topic created automatically via `createForumTopic` if it doesn't exist; `message_thread_id` persisted
- [ ] Form submit triggers `NotificationChannel.send()` with correct payload and topic id after DB insert
- [ ] TG notification delivery does not block the form response — failure to notify must not fail the lead insert
- [ ] Unit test: `LeadNotificationHandler.renderMessage()` covers email + timestamp formatting
- [ ] Integration test: form submit → `NoopChannel` records correct payload (email, topic „📩 Leads")
- [ ] M3 forward-compatibility confirmed: handler → direct channel call succeeds without `SchedulerDO`
- [ ] All Phase 1 and M2 tests pass
- [ ] CI green

---

## Phase 3: Admin panel — zarządzanie leadami

**User stories**: 13, 14, 15, 16, 17

### What to build

Build the leads management interface in the admin panel. A leads list view shows all submitted leads sorted by `created_at` descending, with columns: email, submission timestamp, status, notes snippet. Status is updatable inline (select or modal) from the list. Clicking a lead opens a detail view or expands inline: full notes field (editable textarea), status selector, delete button. Delete shows a confirmation dialog before calling the server function. All mutations use server functions backed by data-ops queries from Phase 1. The admin panel is auth-guarded — Better Auth (existing) covers this without changes. Demoable: open admin leads list → change status → add notes → delete a lead → all persist on reload.

### Acceptance criteria

- [ ] Leads list view renders all leads sorted by `created_at` descending with email, timestamp, status, notes snippet
- [ ] Status can be updated per lead (new / contacted / interested / closed-won / closed-lost); change persists on reload
- [ ] Notes field is editable per lead (freeform text); change persists on reload
- [ ] Delete lead shows confirmation dialog; confirmed delete removes row from DB and list
- [ ] Leads list is only accessible to authenticated admin — unauthenticated request redirected to login
- [ ] Empty state shown when no leads exist
- [ ] All server functions use data-ops queries; no raw SQL outside data-ops
- [ ] All Phase 1–2 tests pass
- [ ] CI green

---

## Phase 4: RODO — auto-delete + polityka prywatności

**User stories**: 21, 22, 23

### What to build

Close the RODO compliance loop with two additions. First, a Worker cron trigger (daily) that deletes all leads where `created_at < now() - interval '3 months'`. The cron is silent — no notification on delete, only a DB operation. Second, a static public route `/privacy` in TanStack Start containing the privacy policy (owner-provided content placeholder if copy not yet available). The consent checkbox in the form (Phase 1) links to `/privacy`. Demoable: insert a lead with a backdated timestamp → run cron → lead deleted; `/privacy` responds 200 with content.

### Acceptance criteria

- [ ] Worker cron trigger configured (daily) in `data-service` wrangler config
- [ ] Cron deletes leads with `created_at < now() - 3 months`; does not touch newer leads
- [ ] Cron is idempotent — running twice with no new old leads produces no errors
- [ ] Integration test: insert lead with `created_at = 4 months ago` → run cron → lead deleted
- [ ] Integration test: insert lead with `created_at = 2 months ago` → run cron → lead remains
- [ ] `/privacy` route is publicly accessible without auth and returns 200
- [ ] Consent checkbox in form links to `/privacy`
- [ ] All Phase 1–3 tests pass
- [ ] CI green

---

## Phase 5: Landing page — pełna treść + i18n

**User stories**: 1, 2, 3, 4, 5, 6

### What to build

Replace the Phase 1 minimal skeleton with the full public landing page. Structure (top to bottom): Hero section (headline + subheadline describing the product), Lead capture form (already wired from Phase 1 — just repositioned/styled), "How it works" section, Use case examples (waste collection reminders, birthday alerts — concrete and visual), Auditmos footer (company name, auditmos.com link, tom@auditmos.com). All copy is i18n-keyed (pl/en), reusing the existing i18n system. Language switcher allows manual toggle. Default language determined by browser `Accept-Language` header. Landing is responsive and loads fast on mobile. Demoable: open `powiadomienia.info` → full landing in Polish, switch to English → same layout in English, scroll to form → submit → thank-you → TG notification fires.

### Acceptance criteria

- [ ] Hero section renders with headline and subheadline
- [ ] Lead capture form appears below hero (form fully functional from Phase 1)
- [ ] "How it works" section present with product explanation
- [ ] Use case examples section shows at least two concrete examples (waste collection, birthdays)
- [ ] Auditmos footer present: company name, link to auditmos.com, tom@auditmos.com
- [ ] All landing content available in Polish and English via i18n keys
- [ ] Language switcher toggles all visible text between pl and en
- [ ] Default language follows browser `Accept-Language` header
- [ ] `<title>`, `<meta description>`, Open Graph tags present and localised in both languages
- [ ] Landing loads and is usable on mobile viewport (manual check)
- [ ] Authenticated admin visiting `/` is still redirected to admin dashboard (regression check)
- [ ] All Phase 1–4 tests pass
- [ ] CI green
