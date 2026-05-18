# Vercel Deployment

Projekt používa **Google Sheets ako "databázu"** (source of truth) + lokálnu **SQLite cache** v `/tmp/cache.db` pre rýchle reads. Žiadny PostgreSQL/Supabase nie je potrebný.

## Architektúra na Verceli

```
Browser  →  Vercel Lambda  →  Apps Script Web App  →  Google Sheet
              │                        ↑
              ├─ SQLite cache         (source of truth)
              │   (/tmp/cache.db)
              │
              └─ rebuild zo Sheets pri cold start
```

Každá lambda má vlastný `/tmp/cache.db`. Pri prvom requeste (cold start) sa cache rebuilduje zo Sheets (~5-15s pre 30 000 riadkov). Reads idú z SQLite, writes idú najprv do Sheets potom do SQLite (write-through).

## Pred prvým Vercel deployom

1. **Apps Script Web App** musí byť deployed v Google Sheete — viď `CLAUDE.md` sekciu *Sheets DB*.
2. V Google Sheete musíš mať spreadsheet so správnou štruktúrou tabov — vygeneruje sa pri prvom spustení `npm run sheets:init` lokálne.
3. V Vercel project settings:
   - **Root Directory:** `next-dashboard`
   - **Build Command:** `npm run build`
   - **Install Command:** `npm install`

## Environment variables (Vercel)

| Premenná | Hodnota |
|---|---|
| `AUTH_SECRET` | JWT signing secret (vygeneruj `openssl rand -base64 32`) |
| `SHEETS_APPS_SCRIPT_URL` | URL deployovaného Apps Script Web App-u (`https://script.google.com/macros/s/.../exec`) |
| `SHEETS_APPS_SCRIPT_SECRET` | Shared secret z Apps Script kódu |
| `SHEETS_SPREADSHEET_ID` | ID Google Sheet-u (z URL) |
| `ADMIN_PASSWORD` | Heslo pre legacy `/upload` endpointy (`x-admin-secret` header) |
| `LOG_LEVEL` | `info` v prod, `debug` v deve (voliteľné) |
| `DATABASE_URL` | **NEPOTREBNÉ na Verceli** — bootstrap sám nastavuje `/tmp/cache.db` |

**Staré premenné na ODSTRÁNENIE** (ak boli predtým nastavené):
- `DIRECT_URL` (Supabase pgBouncer)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Google OAuth — odstránené v auth refactore)
- `DEV_LOGIN_ENABLED` (dev login odstránený)

## Cold start performance

Prvý request po nečinnosti (~15 min na Verceli Hobby) trvá 5-15s — lambda musí stiahnuť všetky taby zo Sheets a postaviť SQLite. Užívateľ uvidí spinner. Druhý request bežní v ms (cache hot).

Ak chceš znížiť cold start, je možnosť pridať Vercel Cron, ktorý pinguje appku každých ~10 minút.

## Backup a recovery

Source of truth je Google Sheet — Drive má version history. Pre formálny backup:

1. **File → Download → Microsoft Excel (.xlsx)** pravidelne (manuálne alebo cez Drive API)
2. Recovery: vytvoriť nový spreadsheet, naimportovať backup XLSX, aktualizovať `SHEETS_SPREADSHEET_ID` v env

## Update Apps Script

Keď meníš [next-dashboard/lib/sheets/](next-dashboard/lib/sheets/) treba pamätať že **Apps Script kód v Google Sheete je samostatný** — Vercel pristupuje cez HTTP. Update Apps Script:

1. V spreadsheete `Extensions → Apps Script`
2. Uprav kód (nový `doPost` switch)
3. **Deploy → Manage deployments → Edit** na aktívnom deploymente
4. **Version:** New version → Deploy
5. URL ostáva rovnaká, env var sa nemení

## Lokálny dev vs Vercel rozdiely

| | Lokálny dev | Vercel |
|---|---|---|
| Cache path | `prisma/dev.db` | `/tmp/cache.db` |
| Persistent cache | Áno (medzi reštartmi) | Nie (ephemeral per lambda) |
| Cold start | Pri prvom request po `npm run dev` | Pri každom novom lambda kontainere |
| Build command | `npm run build` | `npm run build` |
