# PRO Dashboard Next

Interná analytická platforma Kaufland — Next.js + React, **Google Sheets ako databáza**, lokálna SQLite ako read-cache.

Migrované z pôvodného Apps Script dashboardu. Source of truth dát sú Sheet-y; appka cez Apps Script Web App číta a zapisuje, cache v `/tmp/cache.db` (Vercel) alebo `prisma/dev.db` (lokál) zrýchľuje reads.

## Tech stack

- **Framework:** Next.js 15 (App Router, RSC)
- **UI:** React 18, TypeScript 5
- **DB:** Google Sheets (source of truth) + SQLite cache cez Prisma 5
- **Auth:** NextAuth v5 — email + heslo (bcrypt)
- **Hosting:** Vercel

## Dátový model

| Tabuľka | Účel |
|---|---|
| `Store` | Predajne (89×) |
| `User` | Účty s bcrypt heslom + roly ADMIN/GF/VKL/VOD/GL |
| `Metric` | KPI definície |
| `Month` | Kalendár obchodného roka |
| `MonthlyValue` | Hodnoty source ∈ {IST, PLAN, VOD} per store/metric/month |
| `DashboardNote` | Komentáre per scope/metric/role |
| `NoteComment`, `TaskItem` | Diskusie + úlohy |
| `ActivityEntry` | Audit log |
| `WeeklyVodOverride` | Týždenné úpravy VOD |
| `IstAdjustmentRequest` | VOD žiadosti o úpravu IST hodnôt |
| `ImportBatch` | Audit importov |

## Spustenie lokálne

```bash
cd next-dashboard
copy .env.example .env
# Doplň SHEETS_APPS_SCRIPT_URL, SHEETS_APPS_SCRIPT_SECRET, SHEETS_SPREADSHEET_ID, AUTH_SECRET
npm install
npx prisma generate
npx prisma db push  # vytvorí prázdny SQLite cache
npm run sheets:pull # natiahne dáta zo Sheets do cache
npm run dev
```

## Setup Google Sheets backendu

Pre kompletné inštrukcie (Apps Script kód, deployment) pozri sekciu *Sheets DB* v koreňovom `CLAUDE.md`.

Stručne:

1. Vytvoriť spreadsheet v Google Drive
2. `Extensions → Apps Script`, vložiť Apps Script kód, deploy ako Web App ("Anyone")
3. Skopírovať Web App URL a vymyslieť shared secret → do `.env`
4. `npm run sheets:init` — vytvorí všetky taby s hlavičkami
5. Vygenerovať prvý ADMIN hash: `npm run hash-password -- "tvoje-heslo"`, pridať riadok do `User` tabu v Sheete
6. `npm run sheets:pull` → SQLite cache obsahuje admina
7. `npm run dev` → login na `/login`

## NPM skripty

| Skript | Účel |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build (prisma generate + next build) |
| `npm run sheets:init` | Vytvorí/opraví všetky taby v Sheete s hlavičkami |
| `npm run sheets:pull` | Natiahne všetky dáta zo Sheets do lokálnej SQLite cache |
| `npm run hash-password -- "heslo"` | Vygeneruje bcrypt hash hesla |
| `npm run prisma:studio` | GUI nad SQLite cache (read-only odporúčané) |

## Adresárová štruktúra (kľúčové)

```
next-dashboard/
├── app/
│   ├── api/
│   │   ├── admin/users/         # Admin spravuje účty
│   │   ├── import/              # IST, PLAN, štruktúra, reset
│   │   ├── notes/, tasks/, activity/, ist-adjustments/
│   │   └── auth/[...nextauth]/  # NextAuth handler
│   ├── dashboard/, login/, upload/, admin/users/, sumar/
│   └── layout.tsx
├── lib/
│   ├── sheets/                  # Apps Script klient + schema + write-through
│   │   ├── client.ts
│   │   ├── schema.ts
│   │   ├── rows.ts
│   │   └── write-through.ts
│   ├── db/
│   │   ├── client.ts            # Prisma singleton + ensureCacheFresh
│   │   └── bootstrap.ts         # Pull Sheets → SQLite, freshness check
│   ├── auth/
│   │   ├── passwords.ts         # bcrypt + temp password gen
│   │   └── session.ts
│   └── ...
├── prisma/
│   └── schema.prisma            # SQLite cache schema
├── scripts/
│   ├── sheets-init.mjs          # Init tabs in Sheet
│   ├── sheets-pull.mjs          # Force pull Sheets → cache
│   └── hash-password.mjs        # Generate bcrypt hash
├── auth.ts                      # NextAuth v5 — Credentials provider
├── middleware.ts                # Auth + role guard
└── package.json
```

## Auth flow

1. User zadá email + heslo na `/login`
2. NextAuth credentials provider hľadá usera v SQLite cache (cache je live mirror Sheet-u)
3. `bcrypt.compare(password, user.passwordHash)`
4. Pri úspechu sa generuje JWT s rolou + scope, lastLoginAt sa zapisuje do Sheets + cache
5. Middleware injektuje user kontext do headers pre downstream API routes

Roly:

- **ADMIN** — plná správa, importy, user management
- **GF** — General Manager (multi-store view)
- **VKL** — District Manager
- **VOD** — Store Manager (vidí len svoju filiálku)
- **GL** — General view (sumár, žiadne filiálky)

## Workflow

| Operácia | Cesta |
|---|---|
| Import IST mesačných dát | `/upload` → ISTGJ2026 import |
| Import PLAN ročného plánu | `/upload` → PLANGJ2026 import |
| Import štruktúry GF/VKL/filiálky + login | `/upload` → Štruktúra + loginy |
| Pridať usera, reset hesla | `/admin/users` |
| Manuálny refresh cache zo Sheets | `npm run sheets:pull` |

## Známe obmedzenia

- **Cold start na Verceli:** prvý request po nečinnosti môže trvať 5-15s (cache rebuild zo Sheets)
- **Sheets API limity:** ~300 reads/min, ~60 writes/min — pri masovom importe sa môže škrtiť
- **Concurrent writes:** Sheets nemá transakcie — last-write-wins
- **ActivityEntry rast:** každá návšteva pridáva riadok; pri 10M cells/sheet limit treba občas archivovať

## Deployment

Vercel deployment guide v [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md).
