# PRD (STUB) — M3 Landing + Lead Capture

**Milestone:** M3 Landing + Lead Capture
**Status:** STUB — decyzje z `/ask:ask` zapisane, pełne PRD do wypełnienia po zamknięciu M2
**Data:** 2026-04-09
**Poprzednik:** `docs/prd-m2-notification-hub.md` (musi być zamknięty przed rozwinięciem tego stuba)

---

> **Uwaga:** To jest stub. Intencja: zachować decyzje z discovery i listę otwartych pytań. Pełne PRD rozwijamy po M2, gdy platforma notyfikacji będzie działać i M3 może ją dogfoodować (nowy lead → powiadomienie do właściciela przez sam hub).

---

## Problem Statement (draft)

Po pivocie `powiadomienia.info` nie jest już publicznym SaaS-em — jest osobistym hubem autora. Jednak domena i strona główna pozostają publicznie dostępne, więc:
1. **Marnowany ruch** — odwiedzający landing nie mają co tam zrobić ani co z tym zrobić.
2. **Brak walidacji popytu** — nie wiemy, czy „personal notification hub” byłby interesujący dla innych (decyzja z Q4a: chcemy walidować tę hipotezę).
3. **Brak wizytówki developerskiej** — projekt jest portfolio, ale nie komunikuje tego (decyzja z Q4b).

M3 rozwiązuje te trzy braki: publiczny landing z jasnym opisem produktu, formularz „zostaw kontakt jeśli chcesz coś podobnego” (wzorem `wizytowka.link`), sekcja portfolio/wizytówki.

## Solution (draft)

- **Landing page** — nowy content, opis produktu (czym jest hub, dla kogo, jak działa), sekcja portfolio, i18n pl/en (reuse istniejącego systemu).
- **Lead capture form** — prosty formularz (email LUB telefon + opcjonalna wiadomość), anti-spam, rate limiting, zapis do tabeli `leads`.
- **Lead notification source** — nowy lead = `notification_source` instance, która wysyła powiadomienie do właściciela przez hub zbudowany w M2. To jest **dogfooding**: M3 używa platformy z M2, więc każdy bug wyjdzie naturalnie.
- **Mini admin panel** — prosta lista leadów (tylko dla właściciela, za Better Auth), statusy (new / contacted / closed), notatki. Minimum viable — żadnego CRM.

## Known decisions (z `/ask:ask`)

| Obszar | Decyzja | Źródło |
|---|---|---|
| Rola landing | Lead capture + portfolio (dual use) | Q4a+b |
| Form pattern | Wzorem `wizytowka.link` — prosty formularz z email/phone + message | Q4 free text |
| Admin | Tylko owner | Q7b (jeden admin household) |
| Dogfood | Lead → notification → TG do właściciela przez hub z M2 | Moja rekomendacja + użytkownik zaakceptował sekwencję |
| Kolejność | Ostatni milestone, nie blokuje niczego | Q1 — moja rekomendacja zaakceptowana |

## Otwarte pytania (do rozstrzygnięcia przed pełnym PRD)

### Content i pozycjonowanie
1. **Główna wartość dla odwiedzającego** — jak opisujemy produkt tym 0.1% osób, które interesowałyby się budową własnego huba? Czy mówimy o self-hosted, czy SaaS, czy „porozmawiajmy”?
2. **Target audience landing** — developerzy, power users, rodziny/małe grupy, czy ogólnie każdy? Wpływa na ton i słownictwo.
3. **Portfolio vs produkt** — jedna strona z obydwoma sekcjami, czy osobne podstrony? `wizytowka.link` ma jedną.
4. **Case studies / przykłady użycia** — pokazujemy konkretne sources (wywóz odpadów, urodziny, pogoda)? Czy to „żywa demo”?
5. **Sekcja „About me” / kontakt** — LinkedIn, GitHub, email do współpracy devowej?

### Formularz
6. **Pola** — tylko email, tylko telefon, oba opcjonalne z minimum „jedno z dwóch”, plus wiadomość? `wizytowka.link` ma jak konkretnie?
7. **Dodatkowe pola** — imię (opcjonalne), temat, „jak znalazłeś”, „co chcesz automatyzować”?
8. **Walidacja** — client-side + server-side + zod. Normalizacja telefonów (E.164)?
9. **Confirmation flow** — tylko thank-you page, czy email confirmation (double opt-in dla RODO), czy auto-reply?

### Anti-spam
10. **Turnstile vs hCaptcha vs honeypot** — Cloudflare Turnstile jest natywne i darmowe. Wystarczy?
11. **Rate limiting** — per IP? KV? Durable Object?
12. **Word blocklist** — czy filtrujemy obraźliwe treści automatycznie, czy moderacja ręczna w admin panelu?

### RODO + prawne
13. **Checkbox zgody** — jak sformułowany? Link do polityki prywatności (którą trzeba będzie zaktualizować — lead capture zmienia purpose of processing)?
14. **Retencja leadów** — ile trzymamy dane? 12 miesięcy, 24, bez limitu?
15. **Prawo do usunięcia** — jak ktoś prosi o delete, ręcznie przez panel, czy self-service przez link w emailu?

### Admin panel
16. **Auth flow** — czy admin panel żyje pod `/admin` w tej samej aplikacji, czy osobna subdomena? Czy Better Auth z M1 obsługuje to bez modyfikacji?
17. **Statusy leada** — new / contacted / interested / closed-won / closed-lost? A może prostsze: new / seen / done?
18. **Notatki per lead** — freeform text, czy structured fields?
19. **Export** — CSV? JSON? Czy nie potrzeba (few leads expected)?

### Domena i routing
20. **Co jest na `powiadomienia.info`?** Landing (publiczny) czy app (za auth)? Jeśli landing — to app jedzie na `app.powiadomienia.info`?
21. **`/login` vs osobny subdomain** — drobny UX issue, ale wpływa na routing w TanStack Start.

### Dogfood flow
22. **Template powiadomienia o nowym lead** — co trafia na TG topic „leads”? Email / telefon / wiadomość w całości, czy skrócone?
23. **Który topic na TG** — nowy topic „leads”, czy wspólny „system notifications” z innymi alertami (np. delivery failures)?
24. **Rate limit dla `lead → notification`** — co jeśli ktoś spamuje formularz i każdy wpis bije do bota? Batching? Throttling?

## Draft issues (do skonkretyzowania po pełnym PRD)

1. Landing page content + i18n (pl/en) + portfolio section
2. Lead capture form — schema + endpoint + zod + rate limiting + Turnstile
3. `leads` table migration + data-ops queries
4. Lead notification source (dogfood M2 platform)
5. Admin panel — leads list + statuses + notes
6. RODO compliance — privacy policy update + consent handling + retention
7. Routing decision — landing na root vs app na subdomain
8. M3 retro + closeout całego projektu pivot

## Out of Scope (wstępne)

- Full CRM features (pipelines, sequences, tagging, automation)
- Marketing automation (newsletters, drip campaigns)
- Analytics dashboards (GA4, PostHog) — minimum viable, może tylko CF Analytics
- A/B testing landing content
- SEO optimization poza basic meta tags
- Mobile app lub PWA dla admin panelu
- Integracja z zewnętrznymi CRM (HubSpot, Pipedrive)
- Płatności / paywall — `docs/010-payments.md` zostaje osobno, nie łączymy
- Publiczny „status page” platformy

## Further Notes

### Rewizja po M2
Niektóre otwarte pytania (22, 23, 24) zależą od jak wygląda ergonomia `notification_source` framework'u po M2. Jeśli w M2 okaże się, że dodawanie nowego source jest trywialne — M3 leci szybko. Jeśli są tarcia — wracamy najpierw do M2 lessons learned.

### Dogfood jako test M2
M3 jest **najlepszym testem** infrastruktury z M2: nowy typ source, nowy topic, realna trigger (HTTP endpoint zamiast cron/alarm), realny delivery. Jeśli M3 wymaga jakichkolwiek zmian w `NotificationChannel` port, `SchedulerDO` lub domain module — to sygnał, że M2 ma ukryte założenia, które trzeba poprawić (feed back do M2 retro).

### Następny krok
Po zamknięciu M2 (`docs/m2-retro.md` gotowe):
1. Reopen tego dokumentu.
2. `/ask:ask` dla otwartych pytań — ale krócej, bo scope jest mały.
3. `/blueprint:blueprint` → pełne PRD.
4. `/carve:carve` → plan.
5. `/dispatch:dispatch` → issues na GH z milestone M3.
6. Po M3 zamknięciu: **wielki retro całego pivotu** (`docs/pivot-retro.md`), co wraca do `saas-on-cf` template i co było lekcją na przyszłość.
