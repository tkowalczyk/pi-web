# PRD — M3 Landing + Lead Capture

**Milestone:** M3 Landing + Lead Capture
**Status:** FULL PRD — gotowe do `/carve`
**Data:** 2026-04-29
**Poprzednik:** `docs/prd-m2-notification-hub.md` (zamknięty, retro w `docs/m2-retro.md`)
**Tracking issue:** [#11](https://github.com/tkowalczyk/pi-web/issues/11)

---

## Problem Statement

Po pivocie `powiadomienia.info` jest w pełni działającym osobistym hubem notyfikacji (M2), ale publiczny landing page jest pusty — odwiedzający nie wiedzą czym jest ten projekt, nie mają jak wyrazić zainteresowania, a firma Auditmos stojąca za projektem nie jest nigdzie widoczna.

Trzy konkretne braki:

1. **Marnowany ruch** — odwiedzający landing nie mają co tam zrobić, bounce rate 100%.
2. **Brak walidacji popytu** — nie wiemy, czy „personal notification hub" interesuje innych rodziny / małe grupy. Bez formularza lead capture nie ma danych.
3. **Brak obecności Auditmos** — projekt jest showcase'em możliwości Auditmos, ale nie komunikuje tego; potencjalni klienci nie wiedzą do kogo się zwrócić.

M3 rozwiązuje wszystkie trzy: landing opisujący produkt z perspektywy B2C, formularz zapisu na listę zainteresowanych, i widoczna marka Auditmos jako twórca.

---

## Solution

- **Landing page** — publiczna strona na `powiadomienia.info/` (pl/en, i18n reuse z M1) opisująca produkt z perspektywy B2C (rodziny, małe grupy), z konkretnymi przykładami użycia (wywóz odpadów, urodziny), wysokim CTA i sekcją Auditmos w stopce.
- **Lead capture form** — minimalistyczny formularz (tylko email), Cloudflare Turnstile anti-spam, inline potwierdzenie po zapisie. Zgoda RODO z checkboxem i linkiem do polityki prywatności.
- **`leads` table + admin panel** — tabela w DB, admin widzi listę leadów z email / datą / statusem / notatkami. Statusy: `new → contacted → interested → closed-won / closed-lost`. Ręczny delete.
- **Auto-delete cron** — leady starsze niż 3 miesiące usuwane automatycznie (spełnienie deklarowanej retencji RODO).
- **Dogfood: lead → TG** — każdy nowy lead wyzwala powiadomienie na dedykowany topic „📩 Leads" przez ten sam `NotificationChannel` z M2. Pełny email + timestamp. M3 jest najlepszym testem generyczności frameworku z M2.

---

## User Stories

### Landing page — odwiedzający

1. As a visitor, I want to understand what powiadomienia.info does within seconds of landing (hero section with headline and subheadline), so that I know whether it's relevant to me.
2. As a visitor, I want to see a lead capture form high on the page (above the fold or just below hero), so that I can express interest without scrolling.
3. As a visitor, I want to see a "How it works" section with concrete use case examples (waste collection reminders, birthday alerts), so that I can visualize the product in real life.
4. As a visitor, I want to know who built this (Auditmos company name, auditmos.com link, tom@auditmos.com), so that I can contact them for custom work.
5. As a visitor, I want to switch between Polish and English on the landing page, so that I can read it in my preferred language.
6. As a visitor, I want the landing page to load fast on mobile, so that I don't bounce before reading the content.
7. As a logged-in admin visiting `/`, I want to be automatically redirected to the admin dashboard, so that the landing page doesn't interrupt my workflow.

### Lead capture form

8. As a visitor, I want to submit only my email address (no other required fields), so that the form is as low-friction as possible.
9. As a visitor, I want to check a consent checkbox confirming I accept data processing with a link to the privacy policy, so that I understand how my data will be used.
10. As a visitor, I want to see an inline thank-you confirmation immediately after submitting, so that I know my contact was received without navigating away.
11. As a visitor, I want the form to reject invalid email formats with a clear error message, so that I can correct typos before submitting.
12. As a visitor, I want the form protected against spam bots (Cloudflare Turnstile), so that my inbox is not flooded with fake leads.

### Admin panel — zarządzanie leadami

13. As the household admin, I want to see a list of all leads with email address, submission timestamp, status, and notes, so that I can manage follow-up in one place.
14. As the household admin, I want to update the status of a lead (new / contacted / interested / closed-won / closed-lost), so that I can track where each conversation stands.
15. As the household admin, I want to add and edit freeform notes on a lead, so that I can remember context from conversations.
16. As the household admin, I want to delete a lead manually from the admin panel, so that I can fulfill RODO deletion requests immediately.
17. As the household admin, I want new leads to show status `new` by default, so that I always know which leads I haven't reviewed yet.

### Dogfood — TG notification

18. As the household admin, I want to receive a Telegram notification on a dedicated "📩 Leads" topic immediately when someone submits the form, so that I'm aware of new leads in real time without polling the admin panel.
19. As the household admin, I want the Telegram notification to include the full email address and submission timestamp, so that I have all relevant information at a glance.
20. As the household admin, I want the "📩 Leads" Telegram topic to be created automatically (same mechanism as other notification sources), so that I don't need to configure it manually.

### RODO + retencja

21. As the household admin, I want leads older than 3 months to be automatically deleted by a scheduled job, so that I comply with the declared retention policy without manual cleanup.
22. As a lead, I want my data deleted when I request it (via email to tom@auditmos.com), so that I can exercise my RODO right to erasure (fulfilled by manual delete in admin panel).
23. As the household admin, I want a privacy policy page at `/privacy` linked from the consent checkbox, so that leads can read how their data is processed.

---

## Implementation Decisions

### Routing

- `/` renders public landing page for unauthenticated visitors.
- Authenticated users visiting `/` are redirected to the admin dashboard (existing `/app` or equivalent route).
- No subdomain change — admin and landing live in the same TanStack Start deployment.
- `/privacy` — new public route with privacy policy content (static page, owner-provided content).

### Landing page structure (ordered)

1. **Hero** — headline + subheadline describing the product, CTA button scrolling to form.
2. **Lead capture form** — high on page (immediately below hero), email + consent checkbox + Turnstile + submit.
3. **How it works** — short explanation of the hub concept.
4. **Use case examples** — waste collection reminders, birthday alerts (concrete, visual).
5. **Auditmos footer** — company name, auditmos.com link, tom@auditmos.com.

### Lead capture form

- **Fields:** email (required) + RODO consent checkbox (required).
- **Anti-spam:** Cloudflare Turnstile only. No honeypot, no IP rate limiting.
- **Confirmation:** inline thank-you message on successful submit. No email sent to lead.
- **Validation:** client-side (Zod) + server-side (Zod). Standard email format.
- **Every submission triggers one TG notification** — no batching, no throttling (Turnstile covers abuse).

### `leads` table

- Columns: `id`, `email`, `status` (enum), `notes` (text, nullable), `consent_given_at`, `created_at`, `updated_at`.
- Status enum: `new` | `contacted` | `interested` | `closed_won` | `closed_lost`. Default: `new`.
- No export functionality.

### Admin panel

- Leads list view: email, created_at, status (editable inline or via modal), notes (editable).
- Manual delete per row.
- Auth: Better Auth (existing) — admin-only, no changes to auth layer.
- Admin panel Polish only (single admin).

### Auto-delete cron

- Worker cron job (daily) deletes leads where `created_at < now() - 3 months`.
- Implemented as a new cron trigger in `data-service` wrangler config.
- No notification on delete — silent cleanup.

### Dogfood — lead notification

- `LeadNotificationHandler` implements same `renderMessage()` pattern as `WasteCollectionHandler` / `BirthdayHandler` from M2.
- Trigger: HTTP (form submit endpoint) — not scheduled alarm. `NotificationChannel.send()` is trigger-agnostic (validated in M2).
- TG topic: dedicated „📩 Leads", created via same `createForumTopic` mechanism.
- Message format: `📩 <b>Nowy lead</b>\n<code>{email}</code>\n📅 {timestamp}`.
- No `SchedulerDO` involvement — direct handler → channel call (one-shot HTTP trigger).

### i18n

- pl/en from day one. Reuse existing i18n system.
- Landing page content translated in both languages.
- Admin panel: Polish only.

### Privacy policy

- Lives at `/privacy` — static page.
- Content provided by owner (out of scope for this PRD — prerequisite before launch).
- Must cover: purpose of processing, data retention (3 months), right to erasure (email tom@auditmos.com), controller identity (Auditmos).

### System boundaries

- **Cloudflare Turnstile** — new external dependency. Token verified server-side before saving lead.
- **Neon Postgres** — `leads` table added. Accessed via `data-ops`.
- **Telegram Bot API** — reused from M2. New topic „📩 Leads".
- **TanStack Start** — new public routes (`/`, `/privacy`). Server function for form submission.

---

## Validation Strategy

### Landing page

- Renders correctly on mobile and desktop (manual browser check).
- Language switcher toggles all visible text between pl and en.
- Authenticated admin visiting `/` is redirected to admin dashboard — verified by navigating to `/` while logged in.
- `<title>`, `<meta description>`, Open Graph tags present and correct.

### Lead capture form

- Submit with valid email + consent checked → lead created in DB, inline thank-you shown.
- Submit with invalid email → validation error shown, no DB write.
- Submit without checking consent → validation error shown, no DB write.
- Submit without valid Turnstile token → server rejects with 400, no DB write.
- Submit triggers TG notification to „📩 Leads" topic with full email + timestamp.
- Two consecutive valid submissions from different emails → two separate TG notifications.

### Admin panel

- Leads list shows all submitted leads with correct email, timestamp, status.
- Status update persists after page reload.
- Notes edit persists after page reload.
- Manual delete removes lead from DB and list.
- No leads visible to unauthenticated users (auth guard active).

### Auto-delete cron

- Integration test: insert lead with `created_at = now() - 4 months` → run cron → lead deleted.
- Integration test: insert lead with `created_at = now() - 2 months` → run cron → lead remains.

### Dogfood

- Unit test: `LeadNotificationHandler.renderMessage()` returns correct HTML with email and timestamp.
- Integration test: form submit → `NoopChannel` records correct payload (email, topic „📩 Leads").
- `LeadNotificationHandler` passes same contract tests as other handlers (trigger-agnostic interface).

### RODO

- Privacy policy page accessible at `/privacy` without auth.
- Consent checkbox present and required on form (not submittable without it).
- `consent_given_at` column populated on every lead row.

---

## Out of Scope

- **Dwukierunkowy formularz** — brak pola "wiadomość" / "co chcesz zautomatyzować".
- **Email confirmation / double opt-in** — inline thank-you wystarczy.
- **Export leadów** — CSV/JSON; oczekiwana mała liczba leadów.
- **Full CRM** — pipelines, sequences, tagging, automation, integrations.
- **Marketing automation** — newslettery, drip campaigns.
- **Analytics** — GA4, PostHog; jedynie Cloudflare Analytics pasywnie.
- **A/B testing** — tylko jedna wersja landing.
- **SEO optimization** — poza basic meta tags i Open Graph.
- **Mobile app / PWA** dla admin panelu.
- **Self-service RODO delete** — usunięcie przez link w emailu; ręczny delete w adminie wystarczy.
- **Rate limiting na poziomie notyfikacji** — Turnstile pokrywa abuse.
- **Publiczny status page** platformy.
- **Płatności / paywall** — poza zakresem M3.
- **Multi-household** — jeden admin, jedna instancja.
- **SchedulerDO dla lead handler** — trigger HTTP, nie cron/alarm.

---

## Further Notes

### Dogfood jako test M2

M3 jest ostatecznym testem generyczności frameworku z M2. `LeadNotificationHandler` + HTTP trigger zamiast DO alarm = nowy typ triggera. Jeśli implementacja wymaga zmian w `NotificationChannel` port, handler interface lub domain module — to sygnał do M2 retro, nie patch w M3.

### Privacy policy — prerequisite

Przed launchem M3 właściciel musi dostarczyć treść polityki prywatności obejmującą lead capture. Bez tego `/privacy` będzie placeholder — formularz nie może być publicznie dostępny bez kompletnej polityki.

### Auditmos branding — treść landing

Copywriting landing page (nagłówki, opisy sekcji) tworzy właściciel — PRD nie specyfikuje treści, tylko strukturę i sekcje. Kod przyjmuje i18n klucze; wartości kluczy to decyzja treściowa poza PRD.

### Następny krok

1. `/carve` → tracer-bullet phases w `plans/m3-landing-lead-capture.md`
2. `/dispatch` → GitHub issues pod milestone M3
3. Po M3 zamknięciu: `docs/pivot-retro.md` — wielki retro całego pivotu
