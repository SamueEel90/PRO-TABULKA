# Vercel Deployment

Tento projekt ma dve build cesty:

- lokalny development a lokalny build: SQLite schema `prisma/schema.prisma`
- Vercel / production build: PostgreSQL schema `prisma/schema.postgres.prisma`

## Co uz je pripravene

- legacy dashboard assets su checknute v `legacy-assets/`
- route `app/legacy-index/route.ts` vie v produkcii citat interne assets
- build script pre Vercel vie vygenerovat Prisma client pre PostgreSQL

## Pred prvym Vercel deployom

1. Vytvor PostgreSQL databazu, napriklad Neon, Supabase alebo Vercel Postgres.
2. Nastav `DATABASE_URL` vo Vercel project settings na Supabase pooler URL.
3. Nastav `DIRECT_URL` na priamu Supabase DB URL s hostom `db.<project-ref>.supabase.co:5432`.
4. Nastav Root Directory na `next-dashboard`.
5. Nastav Build Command na `npm run build:vercel`.
6. Nastav Install Command na `npm install`.
7. Raz inicializuj schema do prazdnej PostgreSQL databazy prikazom:
   `npm run prisma:dbpush:postgres`
8. Ak Prisma z lokalu nevie do Supabase dosiahnut, otvor SQL Editor a spusti obsah `prisma/supabase-init.sql`.

## Poznamky

- `npm run build` ostava lokalny SQLite build.
- `npm run build:vercel` je urceny pre produkcny PostgreSQL deployment.
- Supabase priama DB URL ma tvar `postgresql://postgres:<heslo>@db.<project-ref>.supabase.co:5432/postgres`.
- Supabase pooler URL sa pouziva pre runtime `DATABASE_URL`, priama URL pre `DIRECT_URL` a Prisma schema operacie.
- SQL bootstrap pre Supabase SQL Editor je v `prisma/supabase-init.sql`.
- Ak stale upravujes root `Index.html`, `dashboardSharedHelpers.html` alebo `sharedStyles.html`, pred lokalnym buildom sa automaticky zosynchronizuju do `legacy-assets/`.
