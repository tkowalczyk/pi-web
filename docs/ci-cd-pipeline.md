# Pipeline CI/CD

## Przegląd

Dokument opisuje istniejacy, w pelni dzialajacy pipeline CI/CD dla monorepo `powiadomienia.info`. Kazda zmiana kodu przechodzi przez zautomatyzowane testy i bramki jakosci przed dotarciem do srodowiska stagingowego lub produkcyjnego.

```
PR otwarty
    |
    v
[neon-branch] Tworzy efemerycza galaz Neon Postgres (ci/pr-{nr})
    |
    v
[ci] Lint (Biome) + Testy (Neon managed) + Bramki doradcze
    |
[cleanup-neon-branch] Usuwa galaz Neon (zawsze, nawet przy bledzie)
    |
    v
PR zmergowany do main
    |
    v
[deploy-stage] Automatyczny deploy na stage (data-service + user-application)
    |
    v
Deploy na prod (reczny, wymaga zatwierdzenia przez reviewer)
```

---

## 1. Struktura repozytorium

```
.github/
└── workflows/
    ├── ci.yml             # Bramka jakosci: PR + push do main
    ├── deploy-stage.yml   # Auto-deploy na staging po merge
    └── deploy-prod.yml    # Reczny deploy na produkcje z zatwierdzeniem
packages/
└── test-harness/
    └── src/
        └── db.ts          # Fabryka testowej bazy danych (dual-profile)
```

---

## 2. GitHub Actions — workflow CI (`ci.yml`)

**Plik:** `.github/workflows/ci.yml`

**Wyzwalacze:**
- `pull_request` do brancha `main`
- `push` do brancha `main`

**Wspolbieznosc:** `ci-${{ github.ref }}`, nowe uruchomienie anuluje poprzednie na tym samym ref.

### Job: `neon-branch` (tylko PR)

Tworzy efemerycza galaz Neon Postgres dla kazdego PR, tak aby testy dzialaly na prawdziwym Postgresie zamiast na emulacji.

```
Akcja: neondatabase/create-branch-action@v6
Nazwa galezi: ci/pr-{numer_pr}
Czas zycia: od otwarcia PR do zamkniecia/merge (patrz: cleanup-neon-branch)
```

Wyjscia joba ustawiane jako zmienne srodowiskowe dla joba `ci`:
- `db_url` — connection string z pooler (przekazywany jako `TEST_DATABASE_URL`)
- `branch_id` — identyfikator galezi Neon (uzywany przy sprzataniu)

Zmienne wymagane przez akcje:
- `vars.NEON_PROJECT_ID` — GitHub Variable, wstrzykiwana automatycznie przez integracjê Neon
- `secrets.NEON_API_KEY` — GitHub Secret, wstrzykiwany automatycznie przez integracjê Neon

### Job: `ci` (zawsze, nawet gdy `neon-branch` pominieto)

`if: always()` — job uruchamia sie niezaleznie od tego, czy job `neon-branch` zostal pominiety (push do main nie tworzy galezi Neon).

**Kroki:**

1. Checkout (`actions/checkout@v4`, `fetch-depth: 1`, bez utrwalania credentials)
2. Setup pnpm (`pnpm/action-setup@v4`)
3. Setup Node.js LTS (`actions/setup-node@v4`, cache pnpm)
4. `pnpm install --frozen-lockfile`
5. `pnpm run build:data-ops` — kompilacja pakietu wspoldzielonego (wymagane przed testami)

**Twarde bramki (blokuja merge):**

| Krok | Polecenie | Co sprawdza |
|------|-----------|-------------|
| Lint (Biome) | `pnpm run lint:ci` | Formatowanie i linting calego kodu objetego Biome |
| Testy | `pnpm run test` | Vitest — pelna suita testow |

Srodowisko dla krokow testow jest wstrzykiwane dynamicznie:

```yaml
env:
  TEST_DATABASE_URL: ${{ needs.neon-branch.outputs.db_url }}
  TEST_DB_PROFILE: ${{ needs.neon-branch.outputs.db_url && 'managed' || 'local' }}
```

Oznacza to:
- **Na PR:** `TEST_DB_PROFILE=managed`, `TEST_DATABASE_URL` = URL efeme­rycznej galezi Neon — testy dzialaja na prawdziwym Postgresie.
- **Na push do main:** `TEST_DB_PROFILE=local`, `TEST_DATABASE_URL` = pusty — testy uzyja PGLite w pamieci.

**Bramki doradcze (continue-on-error: true — nie blokuja merge):**

| Krok | Polecenie | Co sprawdza |
|------|-----------|-------------|
| Typecheck (advisory) | `pnpm run types` | TypeScript w `data-service` + `user-application` |
| Dead code (advisory) | `pnpm run knip` | Martwy kod i nieuzywane zaleznosci (Knip) |
| Dep freshness (advisory) | `pnpm run deps` | Przestarzale zaleznosci (Taze) |

Bramki doradcze sa doradcze dlatego, ze przed startem M1 istnieje juz dug techniczny w `apps/` i `packages/data-ops`. Beda przeniesione do twardych bramek gdy dug zostanie sprzatniêty (faza 3+).

### Job: `cleanup-neon-branch` (tylko PR)

Usuwa efemerycza galaz Neon po zakonczeniu CI, nawet gdy `ci` sie nie powiedlo:

```yaml
if: always() && needs.neon-branch.outputs.branch_id
uses: neondatabase/delete-branch-action@v3
```

Dzieki temu nie pozostaja osierocone galêzie Neon, ktore moglyby generowac koszty.

---

## 3. GitHub Actions — workflow deploy-stage (`deploy-stage.yml`)

**Plik:** `.github/workflows/deploy-stage.yml`

**Wyzwalacze:**
- `push` do brancha `main` (po przejsciu CI)
- `workflow_dispatch` (reczne uruchomienie)

**Wspolbieznosc:** `deploy-stage`, `cancel-in-progress: false` — deploye na stage nie anuluja siebie wzajemnie.

**Srodowisko GitHub:** `stage` (otwarte, bez wymaganego zatwierdzenia)

**URL docelowy:** `https://stage.powiadomienia.info`

**Kroki:**

1. Checkout (`fetch-depth: 1`)
2. Setup pnpm + Node.js LTS
3. `pnpm install --frozen-lockfile`
4. `pnpm run build:data-ops`
5. `pnpm run deploy:stage:data-service` — deploy workera Hono
6. `pnpm run deploy:stage:user-application` — deploy frontendu TanStack Start

Kazdy krok deploy uzywa:
```yaml
env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Kazde polecenie deploy w `package.json` najpierw buduje `data-ops` a potem wywoluje `wrangler deploy --env stage` dla danej aplikacji.

---

## 4. GitHub Actions — workflow deploy-prod (`deploy-prod.yml`)

**Plik:** `.github/workflows/deploy-prod.yml`

**Wyzwalacze:**
- **Wylacznie** `workflow_dispatch` — ktos musi rêcznie kliknac "Run workflow" w zakladce Actions

**Wejscie:**
```yaml
inputs:
  ref:
    description: "Git ref to deploy (defaults to main)"
    required: false
    default: main
```

Mozliwosc podania `ref` pozwala deployowac konkretny commit lub tag, jesli zachodzi potrzeba cofniecia zmian.

**Wspolbieznosc:** `deploy-prod`, `cancel-in-progress: false`

**Srodowisko GitHub:** `production` — wymagany recenzent (tkowalczyk) zanim job zostanie uruchomiony.

**URL docelowy:** `https://powiadomienia.info`

**Kroki:** identyczne jak `deploy-stage`, ale z `--env prod`.

**Limit czasowy:** 20 minut (stage: 15 minut) — wigla na wypadek wolniejszej sieci CDN Cloudflare dla produkcji.

---

## 5. Diagramy przeplywow

### PR flow (pelny)

```
git push origin feature/xxx
        |
        v
    GitHub PR otwarty
        |
   +-----------+----------+
   |                      |
   v                      |
[neon-branch]             |
Tworzy ci/pr-{N}          |
w Neon Postgres           |
   |                      |
   v                      v
[ci] (needs: neon-branch, if: always())
  1. checkout
  2. pnpm install
  3. build data-ops
  4. biome ci .           <- blokuje merge jesli nie przejdzie
  5. vitest run           <- blokuje merge jesli nie przejdzie
     TEST_DB_PROFILE=managed
     TEST_DATABASE_URL=<neon-branch-url>
  6. pnpm types           <- doradcze, nie blokuje
  7. pnpm knip            <- doradcze, nie blokuje
  8. pnpm deps            <- doradcze, nie blokuje
        |
        v
[cleanup-neon-branch] (if: always() && branch_id istnieje)
Usuwa ci/pr-{N} z Neon
        |
        v
   Status check "Lint + Test + Quality" wymagany przez branch protection
```

### Push do main (po merge)

```
PR zmergowany do main
        |
   +----+----+
   |         |
   v         v
  [ci]    [deploy-stage] (rownolegle)
  (push)  
  TEST_DB_PROFILE=local
  (PGLite, bez Neon)
             |
             v
     deploy:stage:data-service
     deploy:stage:user-application
             |
             v
     https://stage.powiadomienia.info
```

### Deploy produkcyjny

```
Developer otwiera GitHub Actions
        |
        v
"Run workflow" na deploy-prod.yml
Opcjonalnie: podaje ref (commit/tag)
        |
        v
GitHub czeka na zatwierdzenie przez tkowalczyk
        |
        v
Zatwierdzenie -> job startuje
        |
        v
checkout (konkretny ref)
pnpm install
build data-ops
deploy:prod:data-service
deploy:prod:user-application
        |
        v
https://powiadomienia.info
```

---

## 6. Test-harness — dual-profile (`packages/test-harness/src/db.ts`)

Pakiet `test-harness` dostarcza funkcje `createTestDb()` ktora zwraca uchwyt do bazy danych dla testow. Implementacja wspiera dwa profile wybierane przez zmiennik srodowiskowy `TEST_DB_PROFILE`.

### Profile: `local` (domyslny)

```
TEST_DB_PROFILE=local  (lub nie ustawiony)

PGLite (in-memory, @electric-sql/pglite)
  |
  v
drizzle-orm/pglite
  |
  v
Migracje z packages/data-ops/src/drizzle/migrations/dev/
  |
  v
Swiezy schemat gotowy do uzycia w tescie
```

- Kazde wywolanie `createTestDb()` zwraca izolowana baze w pamieci.
- Brak dostêpu do sieci, maksymalna szybkosc.
- Cleanup: `pg.close()` (bezpieczne do wielokrotnego wywolania).

### Profile: `managed`

```
TEST_DB_PROFILE=managed + TEST_DATABASE_URL=<postgres-url>

@neondatabase/serverless (HTTP, neon())
  |
  v
drizzle-orm/neon-http
  |
  v
Migracje z packages/data-ops/src/drizzle/migrations/dev/
  |
  v
Prawdziwy schemat Postgres gotowy do uzycia w tescie
```

- Lacze sie z rzeczywistym Neon Postgres wskazanym przez `TEST_DATABASE_URL`.
- W CI: URL efeme­rycznej galezi PR przekazywany przez job `neon-branch`.
- Lokalnie: developer moze wskazac wlasna galaz Neon.
- Polaczenie HTTP (bez pool) — kazde zapytanie to osobny fetch, nic do czyszczenia.
- Cleanup: no-op (brak polaczenia TCP do zamkniecia).

### Wspolny interfejs

```typescript
export interface TestDbHandle {
  db: PgDatabase<any, any, any>;
  cleanup: () => Promise<void>;
}

export async function createTestDb(): Promise<TestDbHandle>
```

Oba profile zwracaja ten sam interfejs `TestDbHandle`, wiec testy nie muszą wiedziec z jakiego profilu korzystaja.

### Zrodel migracji

Obie profile stosuja migracje ze sciezki:

```
packages/data-ops/src/drizzle/migrations/dev/
```

Sciezka jest rozwiazywana wzgledem lokalizacji pliku `db.ts` (nie CWD), wiec dziala stabilnie z kazdego katalogu:

```typescript
const MIGRATIONS_FOLDER = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../data-ops/src/drizzle/migrations/dev",
);
```

### Seam do wstrzykiwania bazy w testach

`packages/data-ops/src/database/setup.ts` udostepnia seam do wstrzykiwania testowej bazy:

```typescript
// Sciezka produkcyjna (host/user/password)
initDatabase({ host, username, password });

// Sciezka testowa (gotowy uchwyt Drizzle)
initDatabase({ client: handle.db });

// Miedzy testami — czysci slot modulu
resetDatabase();
```

Wszystkie zapytania w `data-ops/src/queries/` uzywaja `getDb()` ktory czyta z tego slotu. Dzieki temu test moze podmieniac baze bez modyfikowania kodu zapytan.

---

## 7. Stos bramek jakosci

| Narzedzie | Wersja | Polecenie | Przeznaczenie | Status w CI |
|-----------|--------|-----------|---------------|-------------|
| Biome | 2.4.4 | `pnpm lint:ci` | Lint + formatowanie | **Twarda bramka** |
| Vitest | ^4.0.15 | `pnpm test` | Testy jednostkowe i integracyjne | **Twarda bramka** |
| tsc | ^5.9.3 | `pnpm types` | Sprawdzanie typow TypeScript | Doradcza |
| Knip | ^5.88.1 | `pnpm knip` | Martwy kod i nieuzywane zaleznosci | Doradcza |
| Taze | ^19.11.0 | `pnpm deps` | Przestarzale zaleznosci | Doradcza |

### Zakres Biome

Biome jest skonfigurowany w `biome.json` z wylaczonym zakresem dla starszego kodu:

```json
"files": {
  "includes": [
    "**",
    "!apps",
    "!packages/data-ops",
    ...
  ]
}
```

Innymi slowy: Biome sprawdza `packages/test-harness` i inne nowe pakiety, ale pomija `apps/` i `packages/data-ops` do czasu gdy legacy code zostanie posprzatane.

### Polecenie `pnpm types`

```bash
pnpm run build:data-ops && pnpm run --filter data-service --filter user-application --if-present types
```

Najpierw przebudowuje `data-ops` (zrodlo prawdy dla typow), a nastepnie uruchamia `tsc` dla obu aplikacji.

---

## 8. Sekrety i srodowiska

### Zmienne GitHub

| Nazwa | Typ | Jak ustawiono | Uzywane w |
|-------|-----|---------------|-----------|
| `NEON_API_KEY` | Secret | Automatycznie przez integracjê Neon | `ci.yml` (neon-branch, cleanup) |
| `NEON_PROJECT_ID` | Variable | Automatycznie przez integracjê Neon | `ci.yml` (neon-branch, cleanup) |
| `CLOUDFLARE_API_TOKEN` | Secret | Rêcznie (Workers Edit, Account scope) | `deploy-stage.yml`, `deploy-prod.yml` |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | Rêcznie | `deploy-stage.yml`, `deploy-prod.yml` |

### Sekrety aplikacji

Sekrety aplikacyjne (polaczenia z bazà, dane logowania SerwerSMS itp.) **nie sa** przechowywane w GitHub. Zarzadzane sa bezposrednio w Cloudflare Workers per-srodowisko:

```bash
wrangler secret put DATABASE_HOST --env stage
wrangler secret put DATABASE_USERNAME --env stage
wrangler secret put DATABASE_PASSWORD --env stage
wrangler secret put SERWERSMS_USERNAME --env stage
wrangler secret put SERWERSMS_PASSWORD --env stage
# ... itd.
```

Skrypt `sync-secrets.sh` automatyzuje masowe wstrzykiwanie sekretow.

### Srodowiska GitHub

| Srodowisko | URL | Ochrona | Wyzwalane przez |
|-----------|-----|---------|-----------------|
| `stage` | https://stage.powiadomienia.info | Brak (otwarte) | Push do main, workflow_dispatch |
| `production` | https://powiadomienia.info | Wymagany recenzent: tkowalczyk | Wylacznie workflow_dispatch |

### Ochrona brancha main

- Wymagany status check: "Lint + Test + Quality" (nazwa joba `ci`)
- Zakaz force push
- Zakaz usuwania brancha

---

## 9. Typowe przeplyw pracy developera

### Otwarcie PR

1. Push brancha feature i otwarcie PR do `main`.
2. GitHub automatycznie uruchamia `ci.yml`.
3. Job `neon-branch` tworzy efemerycza galaz Neon `ci/pr-{N}`.
4. Job `ci` instaluje zaleznosci, buduje `data-ops`, uruchamia Biome i Vitest z `TEST_DB_PROFILE=managed`.
5. Status check "Lint + Test + Quality" musi byc zielony przed mozliwoscia merge.
6. Po zakonczeniu CI (bez wzgledu na wynik) job `cleanup-neon-branch` usuwa galaz Neon.

### Zmergowanie PR

1. Po merge do `main` uruchamiaja sie rownolegle:
   - `ci.yml` (push trigger) — testy z PGLite (szybkie, bez Neon).
   - `deploy-stage.yml` (push trigger) — deploy obu aplikacji na stage.
2. Stage jest dostepny pod `https://stage.powiadomienia.info` po kilku minutach.

### Deploy na produkcje

1. Przejdz do zakladki **Actions** w repozytorium GitHub.
2. Wybierz workflow **"Deploy Production"**.
3. Kliknij **"Run workflow"**.
4. Opcjonalnie podaj `ref` (domyslnie: `main`).
5. GitHub pyta recenzenta (tkowalczyk) o zatwierdzenie.
6. Po zatwierdzeniu job deployuje obie aplikacje na `https://powiadomienia.info`.

### Uruchamianie testow lokalnie

**Profil lokalny (PGLite, domyslny):**
```bash
pnpm test
# lub jawnie:
TEST_DB_PROFILE=local pnpm test
```

Brak zaleznosci zewnetrznych. Testy uzywaja in-memory Postgres emulowanego przez PGLite.

**Profil managed (Neon):**
```bash
TEST_DB_PROFILE=managed TEST_DATABASE_URL="postgres://..." pnpm test
```

`TEST_DATABASE_URL` musi wskazywac na galaz Neon, do ktorej developer ma dostep. Migracje sa aplikowane automatycznie przy kazdym uruchomieniu.

### Dodanie nowej tabeli do schematu

Schemat i migracje w `packages/data-ops` automatycznie przeplywaja do testow bez zadnej dodatkowej konfiguracji:

```
1. Edytuj packages/data-ops/src/drizzle/schema.ts
         |
         v
2. Wygeneruj migracjê:
   cd packages/data-ops
   pnpm drizzle:dev:generate
         |
         v
3. Zastosuj migracjê:
   pnpm drizzle:dev:migrate
         |
         v
4. Przebuduj data-ops:
   pnpm build:data-ops
         |
         v
5. Testy automatycznie widza nowy schemat
   (test-harness stosuje migrations/dev/ przy kazdym createTestDb())
```

---

## 10. Testy hygieniczno-kontraktowe (`repo-hygiene.test.ts`)

Plik `packages/test-harness/tests/repo-hygiene.test.ts` zawiera testy ktore weryfikuja ze pipeline jest poprawnie skonfigurowany. Sa to testy kontraktowe M1-P2:

- Biome jest skonfigurowany (`biome.json` istnieje).
- Knip jest skonfigurowany (`knip.json` istnieje).
- Taze jest skonfigurowany (`taze.config.ts` istnieje).
- Skrypty `lint`, `lint:ci`, `knip`, `deps`, `types` istnieja w `package.json` w korzeniu.
- Pliki `ci.yml`, `deploy-stage.yml`, `deploy-prod.yml` istnieja.

Dzieki temu usuwanie plikow konfiguracyjnych lub zmiana nazw skryptow jest wykrywana w CI zanim ktokolwiek zorientuje sie ze cos jest nie tak.

---

## 11. Odniesienia

- `.github/workflows/ci.yml` — pelny workflow CI
- `.github/workflows/deploy-stage.yml` — deploy na staging
- `.github/workflows/deploy-prod.yml` — deploy na produkcje
- `packages/test-harness/src/db.ts` — implementacja dual-profile
- `packages/data-ops/src/database/setup.ts` — seam do wstrzykiwania bazy
- `packages/data-ops/src/drizzle/migrations/dev/` — zrodlo migracji dla testow
- `packages/test-harness/tests/repo-hygiene.test.ts` — testy kontraktowe CI
- `packages/test-harness/tests/managed-profile.test.ts` — testy profilu Neon
- `biome.json` — konfiguracja Biome (zakres i reguly)
- `plans/m1-fundament.md` — plan M1 w ktorym pipeline zostal zbudowany
