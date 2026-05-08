# PRO TABULKA — Kaufland Dashboard

## Prehľad projektu

Interná analytická platforma Kaufland na správu metrík predajní, plánovania a operačného sledovania. Migrácia z Google Apps Script dashboardu na moderný Next.js/React stack.

Celý kód je v priečinku `next-dashboard/`.

## Tech stack

| Čo | Technológia |
|---|---|
| Framework | Next.js 15 (App Router, RSC default) |
| UI | React 18, TypeScript 5.6 strict |
| ORM | Prisma 5.22 |
| DB dev | SQLite (`prisma/schema.prisma`) |
| DB prod | Supabase PostgreSQL (`prisma/schema.postgres.prisma`) |
| Auth | NextAuth v5 beta 31 (JWT sessions) |
| Validácia | Zod 4.4 |
| Logging | Pino 10 (JSON prod, pretty dev) |
| Parsovanie | xlsx 0.18.5, papaparse 5.4.1 |
| Styling | CSS modules + global CSS (žiadny Tailwind) |
| Hosting | Vercel |
| Fonty | IBM Plex Sans (Google Fonts) |

## Adresárová štruktúra

```
next-dashboard/
├── app/
│   ├── layout.tsx              # Root layout (Providers, fonts, DotField bg)
│   ├── page.tsx                # Redirect → /dashboard
│   ├── globals.css             # Globálne štýly + CSS premenné
│   ├── dashboard/
│   │   ├── page.tsx            # Dashboard index (výber predajne/metrík)
│   │   └── [storeId]/page.tsx  # Dashboard pre konkrétnu predajňu
│   ├── login/
│   │   ├── page.tsx
│   │   ├── login-form.tsx      # Client component (Dev Login / Google OAuth)
│   │   └── login.module.css
│   ├── upload/                 # Admin import stránka
│   ├── sumar/                  # Sumárna stránka
│   └── api/
│       ├── auth/[...nextauth]/ # Auth.js HTTP handler
│       ├── import/
│       │   ├── monthly-ist/    # Import IST dát
│       │   ├── reset-ist-vod/  # Vymazanie IST + VOD dát
│       │   ├── reset-vod/      # Vymazanie VOD overrides
│       │   └── structure-users/# Import org štruktúry + login mapping
│       ├── admin/
│       │   ├── monthly-values/ # Bulk edit mesačných hodnôt
│       │   └── structure-users/# Bulk update štruktúry
│       ├── notes/              # CRUD komentárov/threadov
│       ├── tasks/              # CRUD úloh
│       └── activity/           # Activity log
├── components/
│   ├── legacy-dashboard-host.tsx      # Hlavný dashboard UI komponent
│   ├── note-thread.tsx                # Komentárové vlákna
│   ├── task-counter.tsx               # Badge úloh
│   ├── activity-feed.tsx              # Activity log zobrazenie
│   ├── upload-form.tsx                # File upload
│   ├── structure-users-editor.tsx     # Editor org štruktúry
│   ├── monthly-values-editor.tsx      # Bulk edit hodnôt
│   ├── index-dashboard-monthly-table.tsx # Mesačná tabuľka
│   ├── index-dashboard-chart-section.tsx # Grafy
│   ├── plan-charts.tsx                # Plánové grafy
│   ├── dot-field.tsx                  # Animované pozadie
│   ├── providers.tsx                  # SessionProvider wrapper
│   └── session-indicator.tsx          # Info o prihlásenom userovi
├── lib/
│   ├── db/client.ts            # Prisma singleton
│   ├── api/handler.ts          # API route wrapper (Zod validácia, error handling)
│   ├── auth/session.ts         # Extrahovanie usera z middleware headers
│   ├── logger/index.ts         # Pino logger
│   ├── secrets/index.ts        # Env var accessor
│   ├── schemas/common.ts       # Zdieľané Zod schémy (Role, ScopeKey, StoreId...)
│   ├── import-monthly-ist.ts   # IST CSV/XLSX parsing
│   ├── import-structure-users.ts # Org štruktúra parsing
│   ├── months.ts               # Mesiac label ↔ DB ID (SK názvy, business year)
│   ├── metric-layout.ts        # Poradie/viditeľnosť metrík (localStorage)
│   └── plan-dashboard.ts       # Plánová agregácia
├── prisma/
│   ├── schema.prisma           # SQLite schéma (dev)
│   ├── schema.postgres.prisma  # PostgreSQL schéma (prod)
│   └── supabase-init.sql       # DDL init
├── scripts/
│   ├── build.mjs               # prisma generate + next build
│   ├── import-ist.mjs          # CLI IST import
│   ├── import-plan.mjs         # CLI PLAN import
│   ├── import-structure-login.mjs # CLI org import
│   └── set-role.mjs            # CLI role update
├── auth.ts                     # Auth.js v5 konfigurácia
├── auth.config.ts              # Edge-safe auth config (middleware)
├── middleware.ts               # Auth check, role enforcement, header injection
└── package.json
```

## Databázová schéma (PostgreSQL prod)

### Hlavné tabuľky

| Tabuľka | Účel | Kľúč |
|---|---|---|
| `Store` | Predajne (id=4-cif. kód, name, gfName, vklName) | `id` (String) |
| `User` | Zamestnanci (email unique, role, primaryStoreId, gfName, vklName) | `id` (cuid) |
| `Metric` | KPI definície (code, displayName, unit, aggregation) | `code` (String) |
| `Month` | Kalendár (label, year, monthNumber, businessYear, businessOrder) | `id` (String, "YYYY-MM") |
| `MonthlyValue` | Dáta (source, storeId, metricCode, monthId, value, present) | `id` (cuid), unique: [source, storeId, metricCode, monthId] |
| `ImportBatch` | Audit importov (source, fileName, rowCount, status) | `id` (cuid) |
| `DashboardNote` | Komentáre (scopeKey, scopeType, metricKey, role, author, text) | `id` (cuid), unique: [scopeKey, role, metricKey] |
| `WeeklyVodOverride` | VOD týždenné úpravy (storeId, metric, monthLabel, weekIndex, value) | `id` (cuid), unique: [storeId, metric, monthLabel, weekIndex] |

### Poznámky k schéme
- `MonthlyValue.source`: "IST", "PLAN", "FORECAST" atď.
- `DashboardNote.scopeKey`: formát `STORE|{storeId}` alebo `AGGREGATE|VKL|{vklName}` alebo `AGGREGATE|GF|{gfName}`
- `DashboardNote` má unique constraint na [scopeKey, role, metricKey] — jeden komentár per rola per metrika per scope
- Business year: začína marcom (index 2). Marec 2026 → businessYear=2026, businessOrder=0

## Autentifikácia a roly

### Roly (hierarchia)
1. **ADMIN** — plná správa, importy, bulk edit
2. **GF** (General Manager) — viac predajní, aggregate view
3. **VKL** (District Manager) — okresná úroveň, broadcast komentárov na všetky predajne
4. **VOD** (Store Manager) — jedna predajňa, vidí len svoju

### Auth flow
- Middleware (`middleware.ts`) → kontrola JWT → injekcia headerov (`x-user-id`, `x-user-email`, `x-user-role`, `x-user-store`, `x-user-vkl`, `x-user-gf`)
- Verejné routes: `/login`, `/api/auth/*`
- Admin routes: `/api/admin/*`, `/api/import/*`, `/upload` → vyžadujú role=ADMIN
- VOD redirect: VOD môže len na `/dashboard/{svojStoreId}`
- Providers: Google OAuth (@kaufland.sk) + Dev Login (len dev, `DEV_LOGIN_ENABLED=true`)

### Session extraction v API routes
`lib/auth/session.ts` číta headers z middleware — netreba re-verifikovať JWT.

## API routes

### Pattern
Všetky routes používajú wrapper `lib/api/handler.ts`:
```ts
apiRoute({ query, body, params, roles, handler })
```
Validuje Zod schémy, injektuje user context, vracia `{ ok: true, ...data }` alebo `{ ok: false, error }`.

### Endpointy

| Endpoint | Metóda | Prístup | Účel |
|---|---|---|---|
| `/api/import/monthly-ist` | POST | ADMIN | Import IST Excel/CSV |
| `/api/import/structure-users` | POST | ADMIN | Import org štruktúry |
| `/api/import/reset-ist-vod` | POST | ADMIN | Vymazanie IST + VOD |
| `/api/import/reset-vod` | POST | ADMIN | Vymazanie VOD overrides |
| `/api/notes` | GET/POST | Auth | Komentáre (scopeKey + metricKey query) |
| `/api/notes/[id]` | PATCH/DELETE | Auth | Edit/delete komentára |
| `/api/tasks` | GET/POST | Auth | Úlohy CRUD |
| `/api/tasks/[id]` | PATCH/DELETE | Auth | Update/delete úlohy |
| `/api/activity` | POST | Auth | Log aktivity |
| `/api/admin/monthly-values` | GET/POST | ADMIN | Bulk edit mesačných hodnôt |
| `/api/admin/structure-users` | POST | ADMIN | Bulk update štruktúry |

## Scope model

Hierarchický scope systém pre komentáre a úlohy:
- `STORE|{storeId}` — na úrovni predajne
- `AGGREGATE|VKL|{vklName}` — VKL broadcast (viditeľné všetkým predajniam pod VKL)
- `AGGREGATE|GF|{gfName}` — GF aggregate view

`NoteThread` komponent podporuje `broadcastScopeKey` — keď sa pozerá na STORE, zobrazí aj komentáre z VKL úrovne.

## Metriky (KPIs)

Metriky sú definované v DB tabuľke `Metric`. Príklady: Obrat, Hodiny netto, Čistý výkon, atď.
MetricLayout (`lib/metric-layout.ts`) — klientské localStorage pre poradie a skrývanie metrík per scope/role.

## Mesiace a business year

`lib/months.ts`:
- Slovenské názvy mesiacov s aliasmi (s/bez diakritiky)
- Business year začína marcom (BUSINESS_YEAR_START_MONTH_INDEX = 2)
- Month ID formát: `YYYY-MM` (napr. "2026-03")
- BusinessOrder: marec=0, apríl=1, ..., február=11

## Štýlovanie

- Žiadny Tailwind — čistý CSS
- Globálne CSS premenné v `app/globals.css` (farby, spacing, shadows)
- CSS modules pre komponenty (`*.module.css`)
- Farebná paleta: navy (#24567c), červená (#c84f40), zelené, sivé
- Responsive: `clamp()` pre fluid font-size

## NPM skripty

```bash
npm run dev          # Next.js dev server
npm run build        # prisma generate + next build
npm run lint         # ESLint
npm run prisma:studio # Prisma Studio GUI
npm run import:ist   # CLI IST import
npm run import:plan  # CLI PLAN import
```

## Env premenné

```
DATABASE_URL         # PostgreSQL connection string
DIRECT_URL           # Direct PostgreSQL (nie cez pgBouncer)
AUTH_SECRET           # JWT signing secret
GOOGLE_CLIENT_ID      # Google OAuth (prod)
GOOGLE_CLIENT_SECRET  # Google OAuth (prod)
DEV_LOGIN_ENABLED     # "true" pre dev login
LOG_LEVEL             # trace|debug|info|warn|error|fatal
```

## Kľúčové design patterns

1. **Middleware-first auth** — headers injektované pre všetky downstream handlery
2. **RSC-first data** — DB queries na serveri, dáta cez props do client komponentov
3. **Scope-aware access** — hierarchický scopeKey pre komentáre/úlohy
4. **Audit trail** — ActivityEntry + ImportBatch logujú všetky zmeny
5. **Zod validácia** — na vstupe každého API route
6. **Pino structured logging** — JSON v prod s request ID
