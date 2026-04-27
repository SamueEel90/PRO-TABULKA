# PRO Dashboard Next

Toto je nový základ pre migráciu pôvodnej Apps Script aplikácie do Next.js + React + SQL.

## Čo je hotové

- Next.js App Router projekt v priečinku `next-dashboard`
- Prisma schema pre stores, users, months, metrics, import batch log a monthly values
- domovská stránka s jednoduchým prehľadom nad databázou
- upload obrazovka pre mesačný IST import
- API route, ktorá importuje wide CSV formát do SQL tabuľky `MonthlyValue`

## Dátový model

Kľúčové entity:

- `Store`: predajňa
- `User`: budúce prihlásenie a roly ADMIN/GF/VKL/VOD
- `Metric`: metrika ako Obrat GJ2026 alebo Hodiny netto
- `Month`: mesiac s business-year poradím
- `MonthlyValue`: normalizované mesačné hodnoty podľa `source`
- `ImportBatch`: log každého uploadu

## Spustenie

1. `cd next-dashboard`
2. `copy .env.example .env`
3. `npm install`
4. `npx prisma migrate dev --name init`
5. `npm run dev`

## Formát importu

Importer dnes očakáva CSV so stĺpcami:

- `Store ID`
- `Store Name`
- `Metric`
- od 4. stĺpca mesiace ako `marec 2026`, `apríl 2026`, ...

Každý ďalší riadok tej istej predajne môže nechať `Store ID` aj `Store Name` prázdne.

## Ďalšie kroky

1. pridať import pre `PLANGJ2026` a `ISTVODGJ2026`
2. preniesť scope model GF/VKL/VOD a login z pôvodného `Login` sheetu do SQL
3. doplniť dashboard queries a grafy nad SQL dátami
4. pridať weekly VOD override tabuľku a editáciu v React UI
5. prepnúť datasource z SQLite na PostgreSQL, keď bude pripravený produkčný deployment

## Deployment poznámka

- lokálny build ostáva cez `npm run build` a používa SQLite schema `prisma/schema.prisma`
- Vercel build je pripravený cez `npm run build:vercel` a používa PostgreSQL schema `prisma/schema.postgres.prisma`
- deployment postup je zhrnutý v `VERCEL_DEPLOY.md`
