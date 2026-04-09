# PRD (STUB) — M2 Personal Notification Hub

**Milestone:** M2 Personal Notification Hub
**Status:** STUB — decyzje z `/ask:ask` zapisane, pełne PRD do wypełnienia po zamknięciu M1
**Data:** 2026-04-09
**Poprzednik:** `docs/prd-m1-fundament.md` (musi być zamknięty przed rozwinięciem tego stuba)

---

> **Uwaga:** To jest stub. Intencja: zachować decyzje z discovery (`/ask:ask` z 2026-04-09) i listę otwartych pytań, żeby nie wyleciały z pamięci. Pełne user stories, validation criteria i decyzje implementacyjne rozwijamy po M1, gdy lessons learned z pierwszego cyklu TDD na nowym template'cie będą znane.

---

## Problem Statement (draft)

Po zamknięciu M1 `pi-web` ma czysty fundament: model domeny, abstrakcje, test harness, DO scaffold, pusty `TelegramChannel`. Brakuje **realnej wartości dla użytkownika końcowego** (rodzina). Dziś rodzina nie dostaje żadnych powiadomień z tego systemu.

M2 dowozi: działające powiadomienia end-to-end na kanale Telegramowym z topicami, UI do zarządzania notification sources i członkami gospodarstwa, oraz dowód że model domeny jest generyczny (co najmniej dwa typy sources działające live).

## Solution (draft)

- **Pełna implementacja `TelegramChannel`** — Worker → Telegram Bot API (`sendMessage` z `message_thread_id`), retry policy, delivery tracking, rate limit awareness (30 msg/s globalnie, 20/min per group).
- **`SchedulerDO` ożywiony** — `alarm()` faktycznie dispatcha, RPC `updateSchedule` przelicza następny alarm, `triggerNow` działa z UI.
- **Port pierwszego realnego notification source: waste collection** — przepięcie istniejącej logiki odpadów (obecnie SMS przez SerwerSMS) na nowy model domeny + Telegram. Stary kod odpadów idzie w całości do kosza.
- **Drugi notification source: birthdays** — dowód że framework jest generyczny. Handler czyta członków household, sprawdza daty urodzin, wysyła propozycję życzeń na dedykowany topic w TG.
- **UI do zarządzania** — lista notification sources, edycja schedule, przypisanie topic, wybór channel. Lista household members, CRUD, preferencje (timezone, quiet hours).
- **Observability dla delivery** — czy TG dostarczył, jakie kody błędów, retry count, opcjonalnie analytics engine z delivery metrics.

## Known decisions (z `/ask:ask` — nie podlegają re-negocjacji bez przyczyny)

| Obszar | Decyzja | Źródło |
|---|---|---|
| Topologia bota | One-way: Worker → Telegram Bot API, bez webhooka | Q5a |
| Model sources | `notification_sources` w DB + handlers w kodzie | Q6b |
| Scheduling | `SchedulerDO` per notification_source | Q10b |
| Source of truth | DB = SoT, DO subskrybuje przez RPC | Q11c |
| Users | Ty + domownicy jako named users, jeden household | Q7b |
| Kanał SMS | Abstrakcja `NotificationChannel` zostaje, SerwerSMS jako opcjonalny adapter za flagą | Q8b+d |
| Testy | Pełna piramida, rygorystyczny TDD | Q9a |
| Data flow | `UI → mutation → data-ops → DO RPC → alarm()` | `.claude/CLAUDE.md` extended |

## Otwarte pytania (do rozstrzygnięcia przed pełnym PRD)

### Telegram integration
1. **Jeden kanał rodzinny czy kanał + DM fallback?** Co się dzieje, gdy ktoś z rodziny nie jest w kanale (np. zostanie wyrzucony, nie dołączył)? Fallback na DM przez bota, czy ignorujemy?
2. **Format wiadomości** — plain text, Markdown, HTML, czy InlineKeyboard (np. przycisk „dodaj do kalendarza”, „oznacz jako zrobione”)? InlineKeyboard wymaga webhooka do obsługi callbacków, co łamie decyzję o one-way.
3. **Rate limiting** — czy przy naszej skali (5-10 wiadomości dziennie) w ogóle relevantne? Prawdopodobnie nie, ale warto udokumentować.
4. **Retry policy** — ile prób, jaki backoff, czy idempotency key (żeby nie zdublować wiadomości przy retry)?
5. **Konfiguracja topic ids** — wpisywane ręcznie w UI, czy bot sam odkrywa topic (Telegram API ma na to ograniczoną obsługę)?

### Notification sources — waste collection port
6. **Czy przepisujemy logikę harmonogramów od zera, czy reuse'ujemy obecny kod?** Obecny system ma tabele cities/streets/schedules zaimportowane z plików. Czy to zostaje, tylko dostaje nowy handler, czy idzie w całości?
7. **Per-member targeting** — czy każdy domownik ma swój adres (żeby dostawał powiadomienia o własnej ulicy), czy jest jeden adres dla household? Wpływa na schema.
8. **Formatowanie wiadomości dla TG** — jak wygląda „Jutro wywóz szkła na ul. Kwiatowej 5”? Emoji, linki do harmonogramu, przypomnienie ile dni zostało?
9. **Okno przedalertowe** — ile godzin/dni przed? Konfigurowalne per member, per source, czy globalne?

### Notification sources — birthdays
10. **Skąd dane o urodzinach?** Wpisujemy ręcznie w UI household members? Czy integracja z czymś (Google Contacts, vCard)?
11. **Co bot robi z życzeniami?** Tylko przypomina właścicielowi („dziś urodziny X, napisz”), czy generuje tekst życzeń i pozwala jednym kliknięciem wysłać do solenizanta? To drugie może wymagać LLM + drugi kanał wysyłki.
12. **Członkowie rodziny vs urodziny spoza household** — czy mogę wpisać „urodziny koleżanki z pracy”? Encja `birthday` osobna od `household_member`?

### Scheduling edge cases
13. **Co jeśli DO nie dostarcza alarmu (Cloudflare incident)?** Dead letter queue? Cron fallback który sprawdza „spóźnione” alarmy?
14. **Timezone handling** — gdzie żyje: per household, per member, globalnie? Co z letnim/zimowym czasem?
15. **Edycja schedule w trakcie aktywnego alarm()** — co się dzieje? DO musi anulować stary alarm, ustawić nowy. Jak to testujemy?

### UI
16. **Framework form** — zostajemy przy obecnym, czy TanStack Form? Zależy od audytu `saas-on-cf` i M1.
17. **Uprawnienia w UI** — czy member może edytować swoje sources, czy tylko admin? Z `/ask:ask` wynika role-based (Q7b).
18. **Mobile-first?** Ty i rodzina najczęściej będą widzieć wiadomości w TG; UI to głównie setup na komputerze. Ale warto potwierdzić.

### Observability
19. **Gdzie lecą metryki delivery?** Analytics engine, D1, Neon, czy tylko structured logs?
20. **Dashboard / alert kiedy coś nie działa?** Automatyczne powiadomienie (ironicznie — przez hub sam do siebie) gdy delivery fail rate > X%?

## Draft issues (do skonkretyzowania po pełnym PRD)

1. Telegram channel adapter — pełna implementacja (send + error taxonomy + retry)
2. SchedulerDO — alarm() dispatcher + RPC full logic + test clock
3. Waste collection handler — port istniejącej logiki na nowy model
4. UI — household members CRUD
5. UI — notification sources CRUD + schedule editor
6. Birthdays handler — druga instancja source
7. Observability — delivery tracking + logs
8. E2E test — real Telegram bot w test chat, mockable w CI
9. M2 retro

## Out of Scope (wstępne)

- Two-way bot (webhook, komendy, interactive callbacks) — chyba że żeby obsłużyć InlineKeyboard, do decyzji w punktach 2 i 11 wyżej
- Push notifications (APNs/FCM) — nie planowane
- Mobile app / PWA
- Custom notification sources poza wypisanymi w M2
- Integracje z external calendars (Google Calendar, iCal)
- Multi-household — dalej deferred, M1 daje do tego schema door
- SMS delivery — adapter istnieje, ale domyślnie wyłączony, M2 nie aktywuje

## Further Notes

### Rewizja po M1
Lessons learned z M1 muszą przejrzeć wszystkie punkty wyżej. Szczególnie: ergonomia `NotificationChannel` port (czy wystarczy na realną implementację), ergonomia `SchedulerDO` (czy test clock w `@cloudflare/vitest-pool-workers` działa jak zakładamy), wydajność PGLite dla integration tests z większym dataset (cities/streets z obecnego systemu).

### Następny krok
Po zamknięciu M1 (`docs/m1-retro.md` gotowe):
1. Reopen tego dokumentu.
2. Przejść `/ask:ask` dla otwartych pytań 1-20 (albo subset, jeśli niektóre straciły znaczenie).
3. `/blueprint:blueprint` → pełne PRD nadpisujące ten stub.
4. `/carve:carve` → plan.
5. `/dispatch:dispatch` → issues na GH z milestone M2.
