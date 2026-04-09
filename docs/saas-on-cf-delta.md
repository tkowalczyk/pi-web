# saas-on-cf → pi-web delta report

**Data audytu:** 2026-04-09
**Template (reference):** `saas-on-cf` (via `.audit/saas-on-cf` symlink, HEAD @ 2026-04-07)
**Target:** `powiadomienia-info/pi-web` (current HEAD: `ff99887`)
**Audit method:** background agent (Glob + Grep over pi-web, częściowy Read access) + główny kontekst (Read przez symlink, weryfikacja kluczowych plików)

---

## TL;DR

1. **Test harness praktycznie nie istnieje w pi-web.** Template ma root `vitest.config.ts` z projects pattern (3 pakiety), pi-web ma tylko jeden plain-node vitest w `packages/data-ops` i **zero testów** w całym repo. `apps/data-service` ma `@cloudflare/vitest-pool-workers@0.8.19` w devDeps jako martwą zależność. **Bez test harness TDD w M1 jest niemożliwy — to #1 blocker.**
2. **Fork nigdy nie został zaktualizowany po istotnych zmianach w templacie.** Template rozwinął: Durable Objects scaffold, Workflows, warstwowany hono (5-plikowy middleware stack: auth, cors, error-handler, rate-limiter, request-id), `handlers/services/types/utils` rozdzielone, `AGENTS.md`, GH Actions (`.github/workflows/release.yml`), biome + knip + taze, `llms.txt`. **Pi-web ma zero z tego.** Fork stoi na starej linii.
3. **Pivot z multitenant już w połowie zrobiony — w dobrą stronę — ale dług SaaS został.** Better Auth w pi-web jest **już czyste** (zero `organization`/`tenant`/`workspace` w schema ani auth setup) — tylko email+password + Google. Schema nie ma żadnych obiektów z nowej domeny (telegram/household/channel) — wszystko do napisania, nic do wyrzucenia. **ALE** jest pełen stos Stripe/BLIK/subscription (`stripe/`, `components/pricing/`, `core/functions/subscription.ts`, 5 plików w `queries/` z prefiksem `stripe-`/`payment`/`subscription`/`webhook-events`, `docs/010-*.md`) — to **realny dług pivotu do wycięcia w M1**, nie „Better Auth simplified” (jak zakładał draft).

---

## Executive summary

| # | Obszar | Status pi-web | Rekomendacja | Priorytet | Impact na M1 |
|---|---|---|---|---|---|
| 1 | Struktura monorepo | Plain monorepo, brak deep-module boundaries | Port root vitest projects pattern + knip + biome | must | high |
| 2 | Data-ops pattern | Schema bez domeny pivot, brak testów | Napisać nową domenę + fixtures + integration tests | must | high |
| 3 | Auth (Better Auth) | Już uproszczone, zero tenant artifacts | **Nie ruszać.** Dopisać tylko household role binding | nice | low |
| 4 | Wrangler + CI/CD | Zero `.github/`, brak pipeline, rebranding pending | Port `.github/workflows/release.yml` + biome + knip | must | high |
| 5 | Test harness | Nie istnieje (martwa zależność bez config) | Bootstrap: root vitest + workers pool + PGLite + Neon profile | **must (P0)** | **blocker** |
| 6 | Observability | Brak structured logs, brak request-id, brak error handler | Port `hono/middleware/{request-id,error-handler}.ts` + logger | should | med |
| 7 | Frontend (TanStack Start) | Rozwinięty, własne UX (i18n, password strength) | Audit po M2 — nie ruszać w M1 poza strukturą | nice | low |
| 8 | Durable Objects | **Brak `src/durable-objects/` całkowicie** | Port `example-durable-object.ts` jako scaffold → baza dla `SchedulerDO` | **must (P0)** | high |
| 9 | SaaS debt (Stripe/BLIK) | Pełen stos aktywny | **Purge** — całe `stripe/`, `components/pricing/`, query files, docs/010 | must | high |
| 10 | Rebranding | Root `package.json` nadal `"name": "saas-kit"` | Rename do `powiadomienia-info` + wszystkie odniesienia | must | low (ergonomia) |
| 11 | Linting / quality gates | Brak biome, knip, taze, husky | Port całego zestawu z template + hook'i | should | med |
| 12 | Version mismatch (bug) | `vitest@^4.0.15` w `data-ops/deps` + `~3.2.0` w `data-service` | **Fix natychmiast** — jednolity vitest v4 w devDeps | **must (P0)** | low (quick-win) |

---

## Szczegóły per obszar

### 1. Struktura monorepo + granice pakietów

**saas-on-cf:**
- `vitest.config.ts` w root z `projects: ["packages/data-ops", "apps/data-service", "apps/user-application"]` — unified test run
- `biome.json` + `knip.json` + `taze.config.ts` + `.biome-plugins/` — pełny zestaw quality gates
- `AGENTS.md` na root — konwencje dla AI/devów
- `llms.txt` — machine-readable spec projektu
- `.github/workflows/release.yml` — CI z release flow (prawdopodobnie semantic-release, widać `.releaserc.json`)
- `apps/data-service/src/` ma jasno rozdzielone: `hono/`, `durable-objects/`, `workflows/`, `queues/`, `scheduled/`, `index.ts`

**pi-web:**
- Brak root vitest config (tylko per-pakiet w `data-ops`)
- Brak biome, knip, taze — zero linter/quality infra
- Brak `AGENTS.md` i `llms.txt`
- Brak `.github/` całkowicie — **zero CI**
- `apps/data-service/src/` ma: `hono/`, `middleware/`, `queues/`, `scheduled/`, `services/`, `kv/`, `stripe/`, `index.ts` — plus `middleware/` istnieje **równolegle** do `hono/`, co łamie warstwowość template'u
- Root `package.json` name = `"saas-kit"` (nie zrebrandowany)

**Delta:**
- Template deep-moduluje worker: `hono/{handlers,services,middleware,types,utils}` — 5 warstw wewnątrz `hono/`. Pi-web ma płaskie `hono/{app.ts, routes/}` + osobne `middleware/` + osobne `services/` na poziomie `src/`.
- Template odchudzony ze stripe/subscription — saas-on-cf przeszedł własny refactor, który pi-web przegapił
- Brak quality infrastructure w pi-web = wszystkie porty z template'u będą się walczyć z brakiem lintera

**Rekomendacja (must):**
1. Port root `vitest.config.ts` z projects pattern
2. Port `biome.json` + `knip.json` + `taze.config.ts`
3. Port `AGENTS.md` (adaptować pod pi-web konwencje)
4. Restrukturyzuj `apps/data-service/src/hono/` na wzór template'u (middleware, handlers, services, types, utils jako podkatalogi)
5. Usuń równoległe `middleware/` i `services/` na poziomie `src/`, przenieś do `hono/`
6. Rebranding `package.json` name
7. `.github/workflows/` — port z template'u + dostosuj pod `pi-web` envs

**Impact:** high. To jest podstawa pod resztę M1.

---

### 2. Data-ops pattern

**saas-on-cf:**
- `packages/data-ops/src/` ma: `auth/`, `client/`, `database/`, `drizzle/`, `health/`
- `client/schema.test.ts` — realny test (jeden, ale istnieje — udowadnia że harness działa)
- Nowsze konwencje drizzle (relations, typed queries)

**pi-web:**
- Rozwinięty `packages/data-ops/src/queries/` z wieloma plikami: `addresses`, `cities`, `streets`, `users`, `stripe-customer`, `payment`, `payments`, `subscription`, `webhook-events`
- Brak testów (**zero** `.test.ts` w repo)
- Lepsze od template'u env-isolation: migracje w `drizzle/migrations/{dev,stage,prod}/` zamiast samego `dev` — to jest **wartość do zachowania i back-portu do template'u**
- Schema bez obiektów domeny pivot (brak telegram, household, channel, notification_source)

**Delta:**
- Template ma działający test pattern, pi-web nie
- Pi-web ma 5 query plików związanych z SaaS (stripe/payment/subscription/webhook) — do purge
- Pi-web ma lepszą multi-env migration strategy (wartość)
- Brak jakichkolwiek query/schema dla nowej domeny (must-write)

**Rekomendacja (must):**
1. Zachować multi-env migration structure pi-web (nie regressować do samego dev)
2. Port test pattern z `packages/data-ops/src/client/schema.test.ts` jako baseline
3. Napisać schema dla: `households`, `household_members`, `channels`, `notification_sources`
4. Napisać integration tests dla wszystkich CRUD paths przez PGLite / Neon branch
5. Usunąć query files: `stripe-customer.ts`, `payment.ts`, `payments.ts`, `subscription.ts`, `webhook-events.ts` (+ wszystko zależne)

**Impact:** high.

---

### 3. Auth (Better Auth)

**saas-on-cf:**
- `packages/data-ops/src/auth/setup.ts` + `schema.ts` — clean config, email+password + Google
- Zero organization/workspace/tenant primitives

**pi-web:**
- **Już czyste** (zweryfikowane: zero wystąpień `organization`/`tenant`/`workspace`/`multitenant` w schema.ts ani auth setup)
- Rozbudowane UX nad template'em: password strength, change password, rate limiting — **wartość do zachowania**
- Google + email/password + account linking

**Delta:**
- Praktycznie minimalna. Pi-web jest **bardziej rozwinięty** niż template w warstwie UX.

**Rekomendacja (nice):**
- **Nie ruszać.** Draft M1 miał „Better Auth simplified” jako osobny issue — **to martwy punkt, do wyrzucenia z M1**.
- Jedyne co potrzeba: po dodaniu `households` schema dopisać role binding (`admin` / `member` scoped to single household). To jest część issue #4 (domain model), nie osobny issue.

**Impact:** low. Oszczędzamy slot w M1.

---

### 4. Wrangler + CI/CD

**saas-on-cf:**
- `.github/workflows/release.yml` + `.releaserc.json` — semantic-release pipeline
- `biome.json` + `knip.json` + `taze.config.ts` w quality gates

**pi-web:**
- **Zero `.github/`** — brak jakiegokolwiek CI
- Brak wszystkich quality gates tools
- Wrangler config istnieje per-app, multi-env działa (dev/stage/prod) — to jest OK

**Delta:**
- Największa — pi-web jest ślepy na PR-ach. Brak regression guard, brak automatic deploy, brak release flow.

**Rekomendacja (must):**
1. Port `.github/workflows/release.yml` (adaptować pod pi-web apps)
2. Dodać workflow `test.yml` — uruchamia `pnpm test:ci` (Neon branch profile) na każdy PR
3. Branch protection na `main` z required check: `test:ci`
4. Manual approval gate dla prod deploy
5. Port `biome.json`, `knip.json`, `taze.config.ts`

**Impact:** high. CI/CD musi wejść razem z test harness — bez tego TDD żyje tylko lokalnie i zero regression protection.

---

### 5. Test harness ⚠️ **P0 BLOCKER**

**saas-on-cf:**
- Root `vitest.config.ts` z projects pattern (3 pakiety)
- Per-package `vitest.config.ts` w `packages/data-ops`, `apps/data-service`, `apps/user-application`
- Realny test: `packages/data-ops/src/client/schema.test.ts`
- `@cloudflare/vitest-pool-workers` skonfigurowane w `apps/data-service`

**pi-web:**
- Jedyny `vitest.config.ts` w `packages/data-ops`, plain node, bez workers pool
- `apps/data-service/package.json` ma `@cloudflare/vitest-pool-workers@0.8.19` w **devDeps bez config**. Zależność martwa.
- `apps/user-application` — brak workers pool i brak vitest config
- **Zero `.test.ts`** w całym repo

**Delta:**
- Pi-web nie ma żadnej realnej infrastruktury testowej. Draft M1 mówił o TDD red-green-refactor dla całego nowego kodu. **Bez test harness TDD jest niemożliwe.**

**Rekomendacja (must, P0 — issue #2 po audycie):**
1. Port root `vitest.config.ts` z projects pattern
2. Per-package vitest configs z workers pool dla `apps/data-service` i `apps/user-application`
3. Skonfigurować dwa profile:
   - `pnpm test` → PGLite (lokalne, szybkie)
   - `pnpm test:ci` → Neon branch (CI, pełna wierność PG)
4. Napisać `test-harness` package z `createTestDb()`, `seedFixtures()`, `mockChannel()` factories
5. Uruchomić na bazowym teście (port z `client/schema.test.ts` template'u) żeby udowodnić że wszystko jest zielone
6. Dopiero po tym każdy kolejny issue w M1 może używać TDD

**Impact:** blocker. Bez tego nic innego w M1 nie ma sensu.

---

### 6. Observability

**saas-on-cf:**
- `hono/middleware/request-id.ts` — korelacja requestów
- `hono/middleware/error-handler.ts` — taxonomy błędów + structured error responses
- `hono/middleware/rate-limiter.ts` — wielopoziomowy rate limit
- (prawdopodobnie) `core/errors.ts` + `lib/logger.ts` — do weryfikacji gdy faza M1 wejdzie w ten obszar

**pi-web:**
- Tylko `middleware/rate-limit.ts` (jeden plik, poza hono dir)
- Brak request-id, brak error handler, brak structured logging
- Ad hoc console.log w różnych miejscach

**Delta:**
- Bez request-id debugowanie dispatchu powiadomień w M2 będzie koszmarem. Wdrożyć teraz.

**Rekomendacja (should):**
1. Port `hono/middleware/{request-id,error-handler,rate-limiter,cors}.ts`
2. Port `core/errors.ts` error taxonomy (do weryfikacji w trakcie issue)
3. Structured logger (min: request-id + level + message + context)
4. **NIE** portować Sentry / analytics engine w M1 — to nice-to-have, M2+ jeśli się okaże potrzebne

**Impact:** med. Nie jest blockerem M1, ale jest fundamentem pod debugowanie M2.

---

### 7. Frontend (TanStack Start)

**saas-on-cf:**
- `components.json` (shadcn) — oficjalna konfiguracja
- `lib/query-keys.ts` — typed query keys
- `core/errors.ts` — shared error types

**pi-web:**
- Rozwinięty UX: password strength, change password, rate limit, i18n (pl/en)
- Brak `components.json` (ale shadcn components istnieją — prawdopodobnie initialized ale config nie zatrzymany)
- Brak typed query keys pattern
- Lepszy i18n (pl/en) — to jest **wartość do zachowania**

**Delta:**
- Pi-web ma więcej funkcji, template ma lepszą strukturę wewnętrzną
- Większość deltu można adresować dopiero w M2 gdy UI dostanie realne strony dla notification sources

**Rekomendacja (nice, porting w M1 tylko jeśli blokuje inne issues):**
1. Port `components.json` żeby shadcn add komendy działały
2. Port pattern `lib/query-keys.ts` — ułatwi M2
3. **NIE ruszać** pozostałej części frontu w M1

**Impact:** low.

---

### 8. Durable Objects ⚠️ **P0 MUST**

**saas-on-cf:**
- `apps/data-service/src/durable-objects/example-durable-object.ts` — scaffold z `blockConcurrencyWhile`, storage persistence pattern

Pełny listing example:
```ts
import { DurableObject } from "cloudflare:workers";

export class ExampleDurableObject extends DurableObject {
    savedData: string | undefined;
    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        ctx.blockConcurrencyWhile(async () => {
            const [savedData] = await Promise.all([ctx.storage.get<string>("savedData")]);
            this.savedData = savedData;
        });
    }
    async saveData(data: string) {
        await this.ctx.storage.put("savedData", data);
        this.savedData = data;
    }
}
```

**pi-web:**
- **Brak `src/durable-objects/` całkowicie.** Zero scaffoldu, zero wzorca.

**Delta:**
- Template ma gotowy wzorzec eager-load w constructorze (`blockConcurrencyWhile`), który jest **idealnym baseline** dla `SchedulerDO` w M2.
- Pi-web startuje z zera — musi w M1 dostać scaffold.

**Rekomendacja (must):**
1. Port `example-durable-object.ts` jako `src/durable-objects/scheduler-do.ts`
2. Rozbudować scaffold o: `alarm()`, RPC `updateSchedule`, RPC `triggerNow`, RPC `getState`
3. DB jako SoT — eager-load konfiguracji w constructorze z data-ops query
4. Wiring w `wrangler.jsonc` (Durable Object namespace binding)
5. Testy w `@cloudflare/vitest-pool-workers` — sprawdzenie że constructor eager-loaduje, RPC działa, `alarm()` jest programowalne z test clock
6. **NIE** implementować pełnej logiki dispatchu — to M2. M1 dowozi scaffold + RPC surface + testy.

**Impact:** high. To jest druga najważniejsza rzecz po test harness.

---

### 9. SaaS debt (Stripe / BLIK / subscription)

**saas-on-cf:**
- Brak stripe/subscription — template został odchudzony wcześniej

**pi-web:**
- `apps/data-service/src/stripe/` — pełny katalog (prawdopodobnie webhook handlers, client)
- `apps/user-application/src/components/pricing/` — komponenty pricing
- `apps/user-application/src/core/functions/subscription.ts` — server functions
- `packages/data-ops/src/queries/`: `stripe-customer.ts`, `payment.ts`, `payments.ts`, `subscription.ts`, `webhook-events.ts`
- `docs/010-payments.md`

**Delta:**
- Cały wertical Stripe/payment musi iść do kosza. To jest dług z pierwotnego saas-on-cf, który template już wyrzucił, a pi-web przechował. Po pivocie (greenfield, no users, no payments) nie ma co zachowywać.

**Rekomendacja (must — dodać jako osobne issue w M1):**
1. **Issue „Purge SaaS debt”** — jeden PR, jedno miejsce:
   - Delete `apps/data-service/src/stripe/`
   - Delete `apps/user-application/src/components/pricing/`
   - Delete `apps/user-application/src/core/functions/subscription.ts`
   - Delete 5 query files (stripe/payment/subscription/webhook)
   - Delete schema tables i migration fragments związane z płatnościami
   - Delete secrets wrangler związane ze stripe (BLIK, publishable keys)
   - Move `docs/010-payments.md` do `docs/archive/` (nie kasuj — historyczny zapis)
2. **Draft M1 miał „Better Auth simplified” jako issue #6** — zastąpić tym.

**Impact:** high. Usuwa realne tarcie dla wszystkich kolejnych issues.

---

### 10. Rebranding (`saas-kit` → `powiadomienia-info`)

**Delta:**
- Root `package.json` `"name": "saas-kit"` — fork nigdy nie został zrebrandowany
- Prawdopodobnie podobne odniesienia w README, CHANGELOG, docs

**Rekomendacja (must, low-impact quick-win):**
- Zmienić name w root + per-package package.json
- Update README
- grep po `saas-kit` w całym repo, podmień

---

### 11. Linting / quality gates

**Delta:** patrz obszar 1 i 4. Template ma pełny zestaw (biome + knip + taze), pi-web ma zero.

**Rekomendacja (should):**
- Part of CI/CD port (obszar 4)

---

### 12. Version mismatch (bug) ⚠️ **P0 QUICK-WIN**

**Delta:**
- `packages/data-ops/package.json`: `"vitest": "^4.0.15"` w **dependencies** (powinno być devDependencies)
- `apps/data-service/package.json`: `"vitest": "~3.2.0"`
- Wersja major mismatch — vitest 3 ↔ 4 ma breaking changes
- vitest w deps = każdy consumer data-ops (apps) ściąga vitest runtime — absurd

**Rekomendacja (must, P0 quick-win — 30 minut):**
1. Przenieść `vitest` z `data-ops/dependencies` do `devDependencies`
2. Zunifikować do `vitest@^4.x` wszędzie
3. Refresh `pnpm-lock.yaml`
4. Zrobić to **przed** bootstrap test harness — inaczej harness walczy z version conflict

---

## Ryzyka i uwagi

1. **Test harness to P0 blocker.** Bez niego wszystko w M1 się sypie. Pierwszy issue do startu **równolegle** z audytem.
2. **`@cloudflare/vitest-pool-workers` v0.8.x** to dość świeży pool. Jest ryzyko że w trakcie bootstrap'u napotkamy bugi / luki w dokumentacji. Time-boxować research na 1 dzień, potem eskalować.
3. **PGLite + Drizzle compatibility** — drizzle relations + typed queries działają na PGLite, ale niektóre typy PG (np. `tstzrange`, custom domains) mogą nie być wspierane. Dla schema household/notification_sources to prawdopodobnie non-issue, ale flag.
4. **Purge SaaS debt może mieć ukryte odniesienia.** Stripe prawdopodobnie jest wbity w auth flow (subscription check w middleware?), routing (`/billing`), schema FK. Zakładać 1-2 dni pełnej pracy, nie pół.
5. **Durable Object namespace migration.** Dodanie nowego DO namespace do wrangler.jsonc wymaga świadomego deploy — fresh namespace na stage, potem prod. Uniknąć skasowania istniejącego state (jeśli jest).
6. **i18n pi-web jest lepszy od template'u** — **nie zastępować** go wersją template'u. Zachować jako wartość i rozważyć back-port do template'u w retro.
7. **Multi-env migrations pi-web** (dev/stage/prod) są lepsze od template'u — j.w., zachować, rozważyć back-port.
8. **`data-service` ma już `middleware/` i `services/` równolegle do `hono/`** — restrukturyzacja w obszarze 1 ryzykuje breakingi w istniejących routes. Testy integracyjne po restrukturyzacji są obowiązkowe.

---

## Proponowana kolejność portingu w M1 (rewizja vs draft)

### Oryginalny draft M1 (z blueprint):
1. Audit delta (issue #1)
2. Test harness bootstrap
3. Align monorepo structure
4. Domain model — household
5. NotificationChannel abstraction + Telegram stub
6. Better Auth simplified
7. CI/CD stage+prod
8. M1 retro

### Rewidowany układ M1 (post-audit):

1. **Audit delta** — ten dokument. ✅ (zrobione)
2. **Fix vitest version mismatch + rebranding quick-win** — 1 dzień, usuwa tarcie dla wszystkich kolejnych issues
3. **Test harness bootstrap** — root vitest + workers pool + PGLite + Neon profile + test-harness package + jeden zielony smoke test
4. **CI/CD pipeline** — `.github/workflows/test.yml` + `release.yml` + branch protection + biome/knip/taze. **Wchodzi wcześnie**, zaraz po harness, żeby wszystkie kolejne issues miały regression gate.
5. **Purge SaaS debt** — delete Stripe/BLIK/subscription. Osobny PR, duży, destrukcyjny, ale jednorazowy. **Zastępuje „Better Auth simplified” z draft — Better Auth jest już czysty.**
6. **Align monorepo structure** — port root configs, biome.json, knip.json, AGENTS.md, restrukturyzacja `hono/` na warstwy middleware/handlers/services/types/utils
7. **Domain model — household + members + channels + notification_sources** — schema + migrations + queries + zod, wszystko pod TDD. Role binding admin/member dla Better Auth tutaj (nie osobny issue).
8. **NotificationChannel abstraction + adapters** — port interface, TelegramChannel stub, SerwerSMSChannel refactor za flagę, NoopChannel w test-harness, contract tests
9. **SchedulerDO scaffold + observability baseline** — port `example-durable-object.ts` jako wzorzec, rozbudować o RPC, tests w workers pool, + port `hono/middleware/{request-id,error-handler}.ts` + structured logger
10. **M1 retro** — `docs/m1-retro.md` z listą rzeczy do back-portu do `saas-on-cf` (np. multi-env migrations, i18n pattern, password strength UX)

### Zmiany vs draft:
- ➕ Dodano #2 (quick-win vitest fix + rebranding) — nie było, a jest wymagane
- ➕ Dodano #5 (purge SaaS debt) — realny dług, który draft pominął
- ➖ Usunięto „Better Auth simplified” — robota już zrobiona
- 🔀 CI/CD przesunięte z #7 na #4 — musi być wcześnie dla regression gate
- 🔀 SchedulerDO i NotificationChannel rozdzielone na dwa issues (#8 i #9) — DO to osobny eksperyment i osobne ryzyko
- 🔀 Observability baseline dodany do #9 razem z SchedulerDO — oba dotyczą warstwy worker

### Szacunkowa waga (relative effort):
- P0 (blocker): #3 (test harness), #4 (CI/CD), #9 (SchedulerDO)
- L (duże): #5 (purge), #6 (restrukturyzacja), #7 (domain model)
- M (średnie): #8 (channel abstraction)
- S (małe): #2 (quick-win), #10 (retro)

---

## Podsumowanie dla właściciela

Pi-web jest forkiem, który zatrzymał się w rozwoju architektonicznym, ale jednocześnie rozwinął się funkcjonalnie w swoich obszarach (i18n, auth UX, multi-env migrations — te rzeczy są **lepsze** od template'u i należy je zachować / back-portować).

Największe braki:
1. **Zero test harness** → bootstrap first
2. **Zero CI** → blocker dla regression safety
3. **Zero Durable Objects** → port scaffold, baza pod M2
4. **Pełen dług Stripe/SaaS** → purge (zastępuje „Better Auth simplified” które jest już gotowe)
5. **Zero observability** → request-id + error handler minimum

Draft M1 z blueprintu był w 80% poprawny, ale:
- Jeden issue był martwy (Better Auth simplified)
- Dwóch realnych issues brakowało (quick-win + purge SaaS debt)
- Kolejność wymagała korekty (CI wyżej, DO osobno od channel)

Po tej rewizji M1 ma **10 issues** (było 8) i jest ~20% cięższy niż pierwotnie zakładano, ale ma realistyczny scope.

**Następny krok:** `/carve:carve docs/prd-m1-fundament.md` z uwzględnieniem tego raportu — carve powinien zrobić plan tracer-bullet phases z tą rewidowaną kolejnością.
