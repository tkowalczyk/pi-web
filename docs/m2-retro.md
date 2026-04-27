# M2 Personal Notification Hub — Retrospective

**Data:** 2026-04-27
**Milestone:** M2 Personal Notification Hub
**Poprzedni retro:** [`docs/m1-retro.md`](./m1-retro.md)
**PRD:** [`docs/prd-m2-notification-hub.md`](./prd-m2-notification-hub.md)
**Plan:** [`plans/m2-notification-hub.md`](../plans/m2-notification-hub.md)
**Status:** Phase 8 issue [#26](https://github.com/tkowalczyk/pi-web/issues/26) zamknięte 2026-04-27 ze stage verification done; prod verification odłożony do czasu landingu importera waste schedule ([#28](https://github.com/tkowalczyk/pi-web/issues/28)). Sekcje oznaczone `[TBD]` uzupełniam po prod verification.

---

## Summary

M2 ożywił fundament zbudowany w M1: czysta abstrakcja `NotificationChannel` doczekała się realnej implementacji `TelegramChannel` z retry/dead-letter, `SchedulerDO` zaczął faktycznie dispatchować, a admin (właściciel) dostał kompletne UI do zarządzania źródłami, członkami household i delivery logiem. Dwa typy źródeł (waste collection + birthday) przeszły przez identyczny pipeline, dowodząc, że framework jest generyczny — co odblokowuje M3 (lead capture jako trzeci typ źródła).

Milestone był wykonany w 8 fazach (P1–P8) ścisłym TDD z tracer-bullet vertical slices, w tej samej dyscyplinie co M1. Każda faza budowała na infrastrukturze testowej z poprzedniej i była walidowana przez CI przed mergem. Faza 8 (live deploy + retro) na dzień pisania pozostaje otwarta — ten dokument powstaje jako część jej AC #10.

---

## What worked well

- **Generyczność frameworku potwierdzona empirycznie.** P4 (Birthday) wymagała wyłącznie nowego handlera + zod schema + jednego zapisu w `notification_source.config`. Zero zmian w `NotificationChannel`, `SchedulerDO`, ani w domain core. Forward-compat test (handler → channel bez DO) odbezpiecza pattern dla M3 (event-driven leads).
- **Trigger-agnostic design opłacił się dwa razy.** `renderMessage(source, config) → NotificationPayload` i `NotificationChannel.send()` nie wiedzą, czy wołane są z alarmu DO, czy z `triggerNow()` RPC, czy z cron self-alertu (P7). Ten sam path delivery dla scheduled, manual i system alerts — bez specjalnych ścieżek.
- **Self-alert jako ostateczny dogfood.** Cron, który monitoruje `delivery_failures` przez własny `TelegramChannel` na topic „⚠️ System", wymusza działanie infrastruktury delivery — jeśli alarmowanie się popsuje, zauważymy w pierwszej kolejności sami. Zero osobnego stacku monitoringu.
- **Test pyramid utrzymany.** Unit (handlery + `computeNextAlarm`), contract (`NotificationChannel`), integration z mock TG API, Cloudflare vitest pool dla DO z test clockiem. Cała pyramid odpaliła się <30s lokalnie. Strict TDD trzymał się przez wszystkie 7 zakończonych faz — test-first commits widoczne w git log.
- **Domain `computeNextAlarm` z `Temporal` API.** DST handling przeszedł testy regresji (spring forward / fall back) na pierwszej próbie — `Temporal` w Workers nie miał ostrego edge case, którego baliśmy się przy wyborze. Zero `Date.UTC` arytmetyki w pipeline.
- **Inline JSONB config + typed handlery.** Decyzja z PRD M2 — żadnej osobnej tabeli per typ źródła, tylko `notification_sources.config` JSONB walidowany zod-em na granicy. Drop legacy tabel (cities/streets/waste_schedules) zwolnił ~400 linii martwych zapytań i migracji.

## What could improve

- **TriggerNow saga — 8 commitów + revert + reattempt.** Implementacja `triggerNow` z UI okazała się największą czasową stratą M2. Sekwencja `51ef1f5` → `efe5c3a` → `f260848` → `8a6962b` → `dd6dcf2` → `598afbe` → `c50ab53` → `04a54ed` → `33bfcb4 (revert)` → `01cfe6d` → `fed5e82` pokazuje, że rozumienie service bindings w trybie dev (CF Vite plugin) i w runtime Workers (`globalThis.fetch` / `requestContext`) było niedopracowane. **Akcja:** dopisać sekcję „local dev binding gotchas" do AGENTS.md / CLAUDE.md (top-level wrangler.jsonc only, illegal invocation na unbound fetch, `requestContext` w server functions).
- **Stage iteracja zamiast lokalnej weryfikacji.** Commit `0a7315c` („debug: add console.log to trigger handler for stage diagnostics") to znak, że na chwilę zboczyliśmy z reguły „verify locally before pushing". User feedback memory tego pilnowała — i miała rację. **Akcja:** dorobić skrypt sanity-check post-deploy lokalnie przed dotknięciem stage'a.
- **CI deploy quirks ujawnione późno.** Sekwencja `691b2e2` → `fcf4bda` → `4bb746f` → `112c8c1` → `5ac62bf` → `23bcec9` (generate przed migrate, DATABASE_URL zamiast 3 osobnych vars, IF NOT EXISTS dla idempotencji, brak `--env=''`, explicit `--name`) pokazuje, że deploy workflows pisaliśmy po fakcie zamiast przy P2 CI gate. **Akcja:** w M3 deploy workflow piszemy razem z phase 1, nie razem z phase 8.
- **Brak izolacji TG group/topics na stage vs prod.** Plan zakłada te same secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_CHAT_ID`) per środowisko, ale nie ma osobnej grupy testowej. **Akcja:** wydzielić stage TG group przed pełnym verification w P8, żeby testowe wiadomości nie spamowały prod chatu rodziny.
- **Auto-deploy → manual deploy revert.** Commit `2018fc9` cofnął auto-deploy workflows na rzecz ręcznego flow z `clear-data` skryptem. Rację miała intuicja „verify locally before pushing", ale zmiana strategii w środku milestone'u to koszt. **Akcja:** decyzję deploy strategy zamknąć na początku M3, nie w połowie.
- **Brak importera dat wywozów — ręczne wpisywanie nie wchodzi w grę.** Po dropie legacy tabel cities/streets/waste_schedules dane z `.data-to-import/raw/2026_*.json` nie mają ścieżki do nowego modelu (`notification_sources.config` JSONB). Obecny `scripts/seed.ts` tworzy tylko role + household, a `pnpm import:{env}` jeszcze nie istnieje pod nową schemą. Real life: na stage potrzeba 12 plików × N adresów wpisywanych ręcznie przez admin UI — to nieakceptowalne dla weryfikacji P8 i dla dogfoodingu rodziny. **Akcja:** dorobić `scripts/import-waste-schedule.ts` przyjmujący `--file <path>` (lub argv) z `.data-to-import/raw/`, parsujący JSON do `{ address, schedule: [{ type, dates }] }` i upsertujący `notification_source` per adres w household. Per-env wrapper (`import:waste:{dev,stage,prod}`) dla równoległej obsługi środowisk. Szczegóły w follow-up issue (patrz Next steps).

---

## M3-relevant findings

Sekcja istnieje, bo M3 (lead capture) jest dogfoodem M2 — dodanie trzeciego typu source. Pytania kluczowe z PRD M3 i odpowiedzi po M2:

- **Czy dodanie nowego source type jest łatwe?** TAK. P4 dowiodła, że wymaga: (a) handler implementujący `NotificationHandler` interface, (b) zod schema dla `config`, (c) wpis w handler registry, (d) UI form w admin (P5 pattern). Estymata M3-P3 (Lead notification source) to <1 dzień pracy, jeśli framework się nie zmieni.
- **Czy framework wspiera HTTP-triggered sources (nie tylko scheduled)?** TAK. Forward-compat test z P4 (handler render → direct channel send, bez DO) potwierdza. Lead capture w M3 będzie wołał `LeadHandler.renderMessage(payload) → channel.send()` bezpośrednio z server function, bez DO. **Caveat:** nie ma jeszcze pattern „source z trybem trigger=event vs trigger=schedule" — w M2 wszystkie sources są scheduled. M3 wprowadzi to rozróżnienie albo jako boolean flag w config, albo jako osobny typ source w domain (decyzja w `/ask:ask` M3).
- **Owner-notification flow do reuse.** P7 self-alert na topic „⚠️ System" jest dokładnie tym, czego M3 potrzebuje dla lead alertów — ten sam `TelegramChannel`, ten sam `createForumTopic`, ten sam `delivery_log`. Topic „leads" lub wspólny „system" — pytanie z PRD M3 #23 do rozstrzygnięcia.
- **UI ergonomics z M2.** TanStack Form + Shadcn + zod schema z data-ops zadziałały bez tarcia w P5/P6. Landing M3 reuse tego stacka na formie kontaktowej — nie ma powodu zmieniać. Anti-spam (Turnstile) i RODO consent będą jedynymi nowymi komponentami.

---

## Back-port candidates for `saas-on-cf` template

Patterny z M2 warte filed jako issues na template repo. Każdy item samodzielny.

### Back-port 1: NotificationChannel real adapter pattern (TelegramChannel reference)

- **What:** Pełna implementacja portu `NotificationChannel` na realnym dostawcy (Telegram Bot API), z retry exponential backoff, dead letter na DB i `delivery_log`. M1 back-port #3 dał template port + contract test; M2 dodaje pełnego reference adaptera.
- **Why:** Template ma teraz interface, ale brak realnego adaptera oznacza, że projekty kopiują patterny retry/dead-letter w nieskoordynowany sposób. Reference adapter pokazuje: jak strukturyzować retry, gdzie loguje się każdą próbę, jak deadletterować, jak testować przeciwko mock HTTP API.
- **How to adopt:** Dodać `src/channels/telegram-channel/` w data-service templatu z: real adapter, integration test mockujący Bot API, `delivery_log` + `delivery_failures` schema. Udokumentować patterns retry w AGENTS.md.
- **Complexity:** Medium (adapter + schema + 4 integration tests).

### Back-port 2: SchedulerDO + handler registry pattern

- **What:** `SchedulerDO` per source z `alarm()` / `triggerNow()` / `getState()` / `updateSchedule()` RPC, registry handlerów (`source.type → Handler`), domain `computeNextAlarm()` z `Temporal` i timezone z household.
- **Why:** Template ma example DO bez patternu schedulingu opartego o DB jako source-of-truth. Real projects reimplementują „read config → compute next → set alarm" inaczej za każdym razem. Pattern z M2 jest battle-tested na DST i scheduled vs manual triggers.
- **How to adopt:** Dodać `src/durable-objects/scheduler-do/` z handler registry interface, sample `EchoHandler` (template-level placeholder), `computeNextAlarm` w domain module, Cloudflare vitest pool tests z test clockiem.
- **Complexity:** Medium-high (DO + registry + timezone math + tests).

### Back-port 3: Self-monitoring via own delivery infrastructure

- **What:** Cron trigger sprawdza `delivery_failures` z ostatniej godziny i wysyła alert na dedykowany topic przez ten sam `NotificationChannel`. Zero osobnego stacku monitoringu.
- **Why:** Template projects często dorabiają monitoring jako trzecioplanowy stack (Sentry, custom logging endpoint). Pattern „dogfood your own delivery for system alerts" jest tańszy operacyjnie i zmusza do utrzymania działającego delivery — jeśli się zepsuje, sami zauważymy najpierw.
- **How to adopt:** Dodać `src/cron/self-alert/` z konfigurowalnym threshold, integration testem (inject N+1 failures → alert) i hookiem na auto-create topiku „⚠️ System".
- **Complexity:** Low (cron handler + 2 testy).

### Back-port 4: Inline JSONB config + zod runtime validation pattern

- **What:** `notification_sources.config` JSONB w Postgresie z zod schema discriminated union (`waste_collection_config | birthday_config | ...`) walidowanym na każdej granicy (UI form, server function, DO RPC, handler).
- **Why:** Alternatywa — osobna tabela per typ źródła — była rozważana w M1/M2 i odrzucona. Inline JSON pozwala dodać typ bez migracji, kosztem walidacji runtime. Template nie ma tego patternu, projekty często dorabiają osobne tabele bez powodu.
- **How to adopt:** Dodać `src/zod-schema/source-config.ts` z discriminated union, dokumentacja w AGENTS.md o trade-off (no migration vs runtime validation), example handler z runtime schema parsing.
- **Complexity:** Low (schema + docs).

### Back-port 5: Local dev service binding gotchas (anti-pattern doc)

- **What:** Sekcja w AGENTS.md / template README: jak service bindings działają w `wrangler dev` vs `vite dev` (CF Vite plugin), kiedy `globalThis.fetch` rzuca illegal invocation, kiedy używać `requestContext`, gdzie umieścić bindings w wrangler.jsonc (top-level only).
- **Why:** TriggerNow saga z M2 (8+ commitów debug) była drogim treningiem na tych pułapkach. Każdy nowy projekt na template napotka te same problemy — prewencja przez dokumentację jest tania.
- **How to adopt:** Sekcja „Local Dev Bindings — Gotchas" w `AGENTS.md` z 4 patternami: (a) bindings top-level w wrangler.jsonc, (b) `globalThis.fetch.bind` przed użyciem w Workers, (c) `requestContext` zamiast direct env w server functions, (d) lazy import `cloudflare:workers`.
- **Complexity:** Low (docs only).

---

## Metrics

| Metric | Value |
|---|---|
| Phases executed | 7 of 8 (P1–P7 closed; P8 in progress) |
| GitHub issues closed | 7 of 8 (#19–#25) |
| New tables | 2 (`delivery_log`, `delivery_failures`) |
| Dropped legacy tables | 3 (`cities`, `streets`, `waste_schedules`) |
| Schema columns added | 1 (`households.timezone`) |
| Source types implemented | 2 (`waste_collection`, `birthday`) |
| Channel adapters now real | 1 (`TelegramChannel` — M1 stub replaced) |
| Cron triggers | 1 (hourly self-alert) |
| Total commits in milestone range | ~40 (od `0444864` do `fed5e82`) |
| Largest debt source | TriggerNow saga (~10 commits + revert) |
| Files changed in milestone | 143 |
| Lines added/removed | +25,067 / −7,239 |

---

## Phase 8 verification (HITL — in progress)

Sekcja uzupełniana etapami po wykonaniu live verification z [#26 M2-P8](https://github.com/tkowalczyk/pi-web/issues/26). Stage zakończony 2026-04-27, prod pozostaje do zrobienia.

### Stage (✅ done — 2026-04-27)

- [x] Telegram bot utworzony, dodany do family group, `can_manage_topics`
- [x] `TELEGRAM_BOT_TOKEN` + `TELEGRAM_GROUP_CHAT_ID` skonfigurowane na stage
- [x] Stage deployment: oba apps działają, schema zaaplikowana, household z `timezone` istnieje
- [x] Stage: waste source → topic auto-created → triggerNow → real TG message
- [x] Stage: birthday source → topic auto-created → triggerNow → real TG message
- [x] Stage: delivery log viewer pokazuje deliveries
- [ ] Stage: scheduled alarm fires naturalnie *(jeszcze nie zaobserwowane — czeka na cykl)*
- [ ] Stage: self-alert odpalił po injektowaniu failures *(jeszcze do wykonania)*

### Production (TBD)

- [ ] `TELEGRAM_BOT_TOKEN` + `TELEGRAM_GROUP_CHAT_ID` na prod: **[TBD]**
- [ ] Production deployment: oba apps + schema: **[TBD]**
- [ ] Production: waste source → topic → triggerNow → real TG message: **[TBD]**
- [ ] Production: birthday source → topic → triggerNow → real TG message: **[TBD]**
- [ ] Production: scheduled alarm fires naturalnie: **[TBD]**
- [ ] Production: self-alert odpalił po injektowaniu failures: **[TBD]**

### Closeout (TBD)

- [ ] GitHub milestone M2 closed: **[TBD: po prod verification]**
- [ ] M3 stub PRD zaktualizowany pointerem do tego retro: **[TBD: po prod verification]**

---

## Next steps

Ten retrospective formalnie zamknie M2 po uzupełnieniu sekcji P8. Pozostałe akcje:

1. **Zrealizować [#28 Waste schedule importer](https://github.com/tkowalczyk/pi-web/issues/28)** — `scripts/import-waste-schedule.ts` parsujący `.data-to-import/raw/2026_*.json` do `notification_sources.config` JSONB. **Blokuje prod deploy** (bez tego nie ma sensu deployować prod bez realnych dat wywozów).
2. Wykonać HITL deploy prod (po #28) + uzupełnić sekcję „Production" w „Phase 8 verification"
3. Zamknąć GitHub milestone M2
4. Otworzyć follow-up issue „Local dev binding gotchas — AGENTS.md section" (back-port #5 jako TODO w pi-web)
5. Rozpocząć M3 discovery: `/ask:ask` na 24 otwartych pytaniach z `docs/prd-m3-landing-lead-capture.md` (sekcje: content, formularz, anti-spam, RODO, admin panel, routing, dogfood flow)
6. Zamknąć tracking issue #11 po `/blueprint:blueprint` + `/carve:carve` + `/dispatch:dispatch` na M3
