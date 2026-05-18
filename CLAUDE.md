# PRO TABULKA — Kaufland Dashboard

## Prehľad projektu

Interná analytická platforma Kaufland na správu metrík predajní, plánovania a operačného sledovania. Migrácia z Google Apps Script dashboardu na moderný Next.js/React stack.

Celý kód je v priečinku `next-dashboard/`.

## Tech stack

| Čo | Technológia |
|---|---|
| Framework | Next.js 15 (App Router, RSC default) |
| UI | React 18, TypeScript 5.6 strict |
| ORM | Prisma 5.22 (na lokálnu SQLite cache) |
| DB — source of truth | **Google Sheets** (cez Apps Script Web App) |
| DB — read cache | SQLite (`prisma/dev.db` lokál, `/tmp/cache.db` Vercel) |
| Auth | NextAuth v5 — email + heslo (bcrypt) |
| Validácia | Zod 4.4 |
| Logging | Pino 10 (JSON prod, pretty dev) |
| Parsovanie | xlsx 0.18.5, papaparse 5.4.1 |
| Styling | CSS modules + global CSS (žiadny Tailwind) |
| Hosting | Vercel |
| Fonty | IBM Plex Sans (Google Fonts) |

## Architektúra DB (kritické pre pochopenie)

```
Browser  →  Vercel Lambda  →  Apps Script Web App  →  Google Sheet
              │                        ↑
              ├─ SQLite cache         (source of truth)
              │
              └─ rebuild zo Sheets pri cold start
```

- **Source of truth** sú Google Sheety — jeden spreadsheet `PRO_TABULKA_DB`, každá Prisma tabuľka má vlastný tab.
- **Lokálna SQLite cache** je *zrkadlo* zo Sheetu, používa sa na rýchle reads cez Prisma.
- **Read path:** všetky API routes volajú `ensureCacheFresh()` (auto-volá `apiRoute` wrapper) ktorá refreshne cache zo Sheets ak je stale, potom čítajú cez Prisma.
- **Write path:** `pushNew`/`pushUpdate`/`pushDelete`/`pushBulkReplaceSlice` z `lib/sheets/write-through.ts` → najprv POST do Apps Script (Sheets), pri úspechu update SQLite cache.
- **Apps Script Web App** je samostatne deployed v Google Drive — Vercel ho volá HTTP-om s shared secretom.

### Sheets DB — Apps Script Web App

Apps Script je v menu `Extensions → Apps Script` v spreadsheete. Endpoint prijíma POST s `{ secret, op, ...args }` a robí CRUD operácie. Podporované ops:
- `ping`, `modifiedTime`, `listTabs`
- `read` (jedna tab), `readAll` (všetky taby)
- `append`, `updateById`, `deleteById`
- `bulkReplace` (rewrite celej tabuľky), `ensureTabs` (idempotent create)

URL + secret sú v env vars `SHEETS_APPS_SCRIPT_URL`, `SHEETS_APPS_SCRIPT_SECRET`. Spreadsheet ID v `SHEETS_SPREADSHEET_ID` (referencia).

### SQLite cache

Cache sa rebuilduje `lib/db/bootstrap.ts:rebuildCache()`:
1. Single round-trip pull zo Sheets (`sheets.readAll(...)`)
2. Wipe všetkých tabuliek (reverse FK order)
3. Insert v FK order, s defenzívnym dedupom by id
4. Zápis meta JSON-u (`prisma/dev.cache.meta.json` lokál, `/tmp/cache.meta.json` Vercel)

`ensureFresh()` rozhoduje kedy znova pullovať:
- Cache neexistuje alebo schemaVersion mismatch → full rebuild
- `lastAttemptAt` < 30s → back-off, nepúšťať znova
- Cache mladší ako 60s → trust
- `modifiedTime` Sheets sa nezmenil → bump local timestamp
- Inak → full rebuild

## Adresárová štruktúra

```
next-dashboard/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                # Redirect → /dashboard
│   ├── globals.css
│   ├── dashboard/[storeId]/
│   ├── login/                  # Email + heslo
│   ├── upload/                 # Admin imports
│   ├── admin/users/            # Admin user management
│   ├── sumar/
│   └── api/
│       ├── auth/[...nextauth]/
│       ├── import/
│       │   ├── monthly-ist/
│       │   ├── monthly-plan/
│       │   ├── structure-users/
│       │   ├── reset-ist-vod/
│       │   └── reset-vod/
│       ├── admin/
│       │   ├── users/, users/[id]/
│       │   ├── monthly-values/
│       │   └── structure-users/
│       ├── notes/, tasks/, activity/
│       └── ist-adjustments/
├── components/
├── lib/
│   ├── sheets/                 # *** Sheets-as-DB vrstva ***
│   │   ├── client.ts           # HTTP klient pre Apps Script
│   │   ├── schema.ts           # Prisma model ↔ Sheet tab mapping
│   │   ├── rows.ts             # SheetRow ↔ object conversion
│   │   └── write-through.ts    # pushNew/Update/Delete/BulkReplaceSlice
│   ├── db/
│   │   ├── client.ts           # Prisma singleton + ensureCacheFresh
│   │   └── bootstrap.ts        # rebuildCache + ensureFresh
│   ├── auth/
│   │   ├── passwords.ts        # bcrypt + temp password gen
│   │   └── session.ts          # headers → CurrentUser
│   ├── api/handler.ts          # apiRoute wrapper
│   └── ...
├── prisma/
│   └── schema.prisma           # SQLite cache schema
├── scripts/
│   ├── sheets-init.mjs         # Create/repair Sheet tabs
│   ├── sheets-pull.mjs         # Force pull Sheets → SQLite
│   └── hash-password.mjs       # Generate bcrypt hash
├── auth.ts                     # NextAuth v5 — Credentials provider
├── auth.config.ts              # Edge-safe config (middleware)
├── middleware.ts               # Auth + role enforcement
└── package.json
```

## Databázová schéma

| Tabuľka | Účel | Kľúč |
|---|---|---|
| `Store` | Predajne (id=4-cif. kód) | `id` |
| `User` | Účty s `passwordHash` (bcrypt) | `id` (cuid), `email` unique |
| `Metric` | KPI definície | `code` |
| `Month` | Kalendár (`YYYY-MM`) | `id` |
| `MonthlyValue` | Dáta (source ∈ IST/PLAN/VOD/FORECAST) | unique: [source, storeId, metricCode, monthId] |
| `ImportBatch` | Audit importov | `id` |
| `DashboardNote` | Komentáre per scope/metric/role | unique: [scopeKey, role, metricKey] |
| `NoteComment`, `TaskItem` | Diskusie + úlohy | |
| `ActivityEntry` | Audit log | |
| `UserLastSeen` | Tracking, deterministický id `lastseen::{userId}::{scopeKey}` | unique: [userId, scopeKey] |
| `WeeklyVodOverride` | VOD týždenné úpravy | unique: [storeId, metric, monthLabel, weekIndex] |
| `IstAdjustmentRequest` | VOD žiadosti o úpravu IST | |

### Poznámky k schéme

- `MonthlyValue.source`: `IST`, `PLAN`, `VOD` (manuálne úpravy), `FORECAST`
- `DashboardNote.scopeKey`: `STORE|{storeId}` / `AGGREGATE|VKL|{vklName}` / `AGGREGATE|GF|{gfName}`
- Business year: marec=0, ..., február=11 (`BUSINESS_YEAR_START_MONTH_INDEX = 2`)
- **SQLite nemá FK enforcement zapnuté** — preto importy môžu zapísať MonthlyValue referencujúce neexistujúci Store bez chyby. Pri parent tabuľkách (Store, Month, Metric, User) musíme používať `prisma.upsert` (nie delete+create) v import endpointoch lebo MonthlyValue/User referencuje tieto parents.

## Autentifikácia a roly

### Roly

1. **ADMIN** — plná správa, importy, bulk edit, user management
2. **GF** (General Manager) — viac predajní, aggregate view
3. **VKL** (District Manager) — okresná úroveň, broadcast komentárov
4. **VOD** (Store Manager) — jedna predajňa
5. **GL** — len sumár, žiadny filiálkový dashboard

### Auth flow

- `/login` → email + heslo formulár
- NextAuth Credentials provider → `bcrypt.compare()` proti `User.passwordHash` v cache
- JWT session s rolou + scope
- Middleware (`middleware.ts`) → injektuje `x-user-*` headers pre downstream handlery
- Verejné routes: `/login`, `/api/auth/*`
- Admin routes: `/admin/*`, `/api/admin/*`, `/api/import/*`, `/upload` → vyžadujú role=ADMIN
- VOD redirect: VOD môže len na `/dashboard/{svojStoreId}`

### User management

- Iba ADMIN cez `/admin/users` môže pridávať userov a resetovať heslá
- Pri pridaní/reset môže ADMIN zadať vlastné heslo, alebo nechať prázdne (vygeneruje sa 10-znakové)
- Heslo sa zobrazí raz po vytvorení/reset — ADMIN ho skopíruje a odovzdá userovi
- Žiadny self-register, žiadny email-based reset
- Bcrypt cost factor = 10
- Bootstrap prvého admina: `npm run hash-password -- "heslo"` → vložiť hash do User tabu v Sheete ručne

### Žiadny Google OAuth ani Dev Login

Pôvodne Google OAuth + Dev Login. Odstránené pri prechode na Sheets-as-DB (corporate security).

## API routes

### Pattern

Všetky moderné routes používajú wrapper `lib/api/handler.ts`:
```ts
apiRoute({ query, body, params, roles, handler })
```
Automaticky volá `ensureCacheFresh()` pred handlerom. Staršie routes (`/api/notes`, atď.) volajú `ensureCacheFresh()` manuálne na vrchu.

### Endpointy

| Endpoint | Účel |
|---|---|
| `/api/import/monthly-ist` POST | Import IST Excel (mesiace ≤ aktuálny) |
| `/api/import/monthly-plan` POST | Import PLAN ročného plánu (celý rok) |
| `/api/import/structure-users` POST | Import org štruktúry + loginy |
| `/api/import/reset-ist-vod` POST | Vymazanie IST + VOD + WeeklyVodOverride |
| `/api/import/reset-vod` POST | Vymazanie len VOD + WeeklyVodOverride |
| `/api/admin/users` GET/POST | List + create user |
| `/api/admin/users/[id]` PATCH | Reset password, toggle active |
| `/api/admin/monthly-values` GET/PUT | Bulk edit mesačných hodnôt |
| `/api/admin/structure-users` GET/PUT | Bulk update štruktúry |
| `/api/notes` GET/POST | Komentáre |
| `/api/notes/[id]` DELETE | Zmazať komentár |
| `/api/tasks` GET/POST | Úlohy |
| `/api/tasks/[id]` PATCH/DELETE | Update/delete úlohy |
| `/api/activity` GET | Activity log + lastSeen tracking |
| `/api/ist-adjustments` GET/POST | VOD žiadosti o úpravu IST |
| `/api/ist-adjustments/[id]` PATCH/DELETE | Schválenie/zamietnutie/zrušenie |

## Write-through pattern

Pre každý zápis:

```ts
// 1. Ensure cache is fresh (alebo cez apiRoute wrapper automaticky)
await ensureCacheFresh();

// 2. Build full record with deterministic id + timestamps
const record = { id: newId(), ...fields, createdAt: nowIso(), updatedAt: nowIso() };

// 3. Push to Sheets first — throws on failure, aborts before cache write
await pushNew('TabName', record);

// 4. Mirror to local cache
await prisma.model.create({ data: { ...record, createdAt: new Date(...) } });
```

Pre updates: `pushUpdate` + `prisma.update`.
Pre deletes: `pushDelete` + `prisma.delete`.
Pre bulk: `pushBulkReplaceSlice(tab, predicate, newRecords)` — read+filter+rewrite v jednom round-tripe.

**Parent tabuľky (Store, Month, Metric, User) v cache idú cez `prisma.upsert`** lebo `deleteMany` by zlyhal na FK constraint.

## Scope model

Hierarchický scope systém:
- `STORE|{storeId}` — úroveň predajne
- `AGGREGATE|VKL|{vklName}` — VKL broadcast (viditeľné všetkým pod VKL)
- `AGGREGATE|GF|{gfName}` — GF aggregate view

`NoteThread` komponent podporuje `broadcastScopeKey` — keď sa pozerá na STORE, zobrazí aj VKL komentáre.

## Mesiace a business year

`lib/months.ts`:
- Slovenské názvy mesiacov s aliasmi (s/bez diakritiky)
- Business year začína marcom (`BUSINESS_YEAR_START_MONTH_INDEX = 2`)
- Month ID formát: `YYYY-MM` (napr. `2026-03`)
- businessOrder: marec=0, apríl=1, ..., február=11

## NPM skripty

```bash
npm run dev               # Next.js dev server
npm run build             # prisma generate + next build
npm run lint
npm run sheets:init       # Create/repair Sheet tabs + headers
npm run sheets:pull       # Force pull Sheets → local SQLite cache
npm run hash-password -- "heslo"   # Generate bcrypt hash
npm run prisma:studio     # GUI nad SQLite cache
```

## Env premenné

```
AUTH_SECRET                   # JWT signing secret
SHEETS_APPS_SCRIPT_URL        # https://script.google.com/macros/s/.../exec
SHEETS_APPS_SCRIPT_SECRET     # Shared secret v Apps Script kóde
SHEETS_SPREADSHEET_ID         # Z URL spreadsheetu (referencia)
DATABASE_URL                  # Lokál: file:./dev.db   |   Vercel: nepotrebné (auto /tmp)
ADMIN_PASSWORD                # Pre legacy /upload x-admin-secret header
LOG_LEVEL                     # trace|debug|info|warn|error|fatal
```

**Žiadne** `DIRECT_URL`, `GOOGLE_CLIENT_*`, `DEV_LOGIN_ENABLED` (odstránené pri migrácii).

## Kľúčové design patterns

1. **Sheets-as-DB s SQLite cache** — Sheets je source of truth, SQLite je rýchle čítanie
2. **Write-through** — všetky writes idú do Sheets pred cache
3. **Deterministické id-čka pre upsert-like vzory** (napr. `UserLastSeen.id = "lastseen::userId::scopeKey"`)
4. **Back-off na cache rebuild** (30s) — ak rebuild zlyhá, app sa nezacyklí
5. **Defensive dedup pri pull-e** — Sheets môže mať duplicate id-čka, posledný vyhráva
6. **Middleware-first auth** — headers injektované pre všetky downstream handlery
7. **RSC-first data** — DB queries na serveri, dáta cez props do client komponentov
8. **Audit trail** — ActivityEntry + ImportBatch

## Známe obmedzenia

- **Cold start ~5-15s na Verceli** (cache rebuild zo Sheets)
- **Concurrent writes:** chránené cez Apps Script `LockService` (serializuje všetky write ops) + optimistic locking cez `expectedModifiedTime` pre `pushBulkReplaceSlice` (retry pri konflikte, 3 pokusy)
- **Sheets kvóty:** ~300 reads/min, ~60 writes/min — IST/PLAN importy môžu škrtiť
- **SQLite FK off** — referenčné chyby sú silent v cache
- **ActivityEntry rast** — bez auto-purge časom narastie; treba občas archivovať
- **Login rate limit je in-memory** (per-lambda, lossy cez cold starts) — útočník hitujúci veľa lambdas obíde. Plus bcrypt(12) robí útok prakticky neefektívny.

## TODOs — Code review backlog

Vychádza z [review z 2026-05-18]. Položky usporiadané podľa priority. Hotové: #1 concurrent writes guard, #2 login rate limit + tighter passwords, #5 odstránený `requireAdminSecret` shim.

### High priority

- **JWT sa nikdy nerefreshuje** — role/scope zapečené v JWT na 30 dní. Ak admin zmení rolu / deaktivuje usera, prístup zostáva platný. Fix: `session: { maxAge: 8h }` alebo cheap `findUnique({ active: true })` v `session` callbacku.
- **Dva paralelné API patterny** — moderné routes (`/api/admin/*`) idú cez `apiRoute` wrapper (Zod, requestId, role check); legacy (`/api/notes`, `/tasks`, `/activity`, `/import/*`) parsujú body manuálne a nekontrolujú že `author` v body zodpovedá session userovi (spoofovateľné). Migrovať na `apiRoute` + brať `author/role` z `ctx.user`.
- **Žiadne retries na Sheets API** — 429 z Apps Script kvóty padne celý import. Pridať expo back-off retry (3 pokusy, 500ms/1s/2s) v `lib/sheets/client.ts:call()` pre transient (429, 5xx, network).
- **`auth.ts` jwt callback rewrituje celý User row pri každom logine** — kvôli `lastLoginAt` posiela aj `passwordHash`. Race condition ak admin zmenil heslo medzi `findUnique` a `pushUpdate`. Fix: nový Apps Script op `updateColumn(tab, id, column, value)` ktorý zmení iba 1 stĺpec.
- **Import endpoint je 309 riadkov** ([app/api/import/monthly-ist/route.ts](next-dashboard/app/api/import/monthly-ist/route.ts)) — extrahovať do `lib/services/import-ist.service.ts` (parseAndValidate, upsertCatalogs, replaceMonthlyValues).
- **Bootstrap back-off bez jitter** — 50 cold lambdas po Sheet update môžu rebuildiť súčasne. Pridať `backoff + random(0..10s)`.
- **"Best-effort" silent catches** — `notes/route.ts:162`, activity log: `catch {}` skrýva chyby. Aspoň `logger.error({ err })`.

### Medium priority

- **Magic numbers v route handleri** — `TIER_HOURS_PER_DAY` v monthly-ist/route.ts patrí do `lib/metrics/constants.ts`.
- **Duplikované Slovak month names** — `lib/months.ts` ich má, ale duplikujú sa v `monthly-ist/route.ts`, `bootstrap.ts`, `scripts/sheets-pull.mjs`, `scripts/sheets-migrate-month-ids.mjs` (4x ten istý array).
- **`coerceValue` swallowne neplatné dáta** — `bootstrap.ts:131` vráti `0` pri NaN. Tichá strata. Lepšie warn + null + skip row.
- **CASCADE delete chýba** — zmazanie Store/Month/Metric nechá MonthlyValue rows ako zombies. Explicitne mazať child rows v delete endpointoch.
- **`lib/legacy/dashboard-service.ts`** — v `lib/legacy/` ale stále aktívny. Buď migrovať, alebo premenovať priečinok.

### Low / nice to have

- **Žiadne testy** — pridať aspoň smoke testy pre importy.
- **Žiadny CI** — GitHub Actions: `npm run lint && tsc --noEmit`.
- **`prisma.ts` deprecated shim** — väčšina kódu stále importuje odtiaľ. Codemod by to vyriešil.
- **Error tracking** (Sentry) — momentálne len Vercel logy.

## Migration history

Pôvodne PostgreSQL/Supabase + Google OAuth + Dev Login. Migrované na Sheets-as-DB + login+heslo z firemných/bezpečnostných dôvodov (vybavenie relačnej DB je v Kauflande zdĺhavé, Sheets je už schválený nástroj). Detaily v `memory/project_sheets_migration.md`.
