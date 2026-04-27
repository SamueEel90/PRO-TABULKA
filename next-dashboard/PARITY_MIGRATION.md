# App Script Parity Migration

Cieľ: React/Next verzia má vyzerať a fungovať 1:1 ako pôvodná Apps Script aplikácia v `Index.html` a `sumar.html`.

## Zvolený prístup

Najrýchlejšia cesta k presnej parite nie je nový redesign, ale kompatibilná migrácia:

- zachovať pôvodný layout a interakčné správanie
- zachovať pôvodný payload kontrakt `getDashboardData(...)`, `getSummaryData(...)`, `getWeeklyVodOverrides(...)`, `saveDashboardChanges(...)`
- portovať shared helper logiku z `dashboardSharedHelpers.html` do TypeScript modulu
- až potom nahradiť `google.script.run` REST alebo server-action vrstvou v Next.js

## Čo už je pripravené

- SQL import základ pre `PLAN`, `IST`, `VOD`
- `PLAN` preview dashboard a summary route
- TypeScript parity kontrakty v `lib/legacy/contracts.ts`
- shared helper parity vrstva v `lib/legacy/shared.ts`

## Čo treba preniesť pre plnú 1:1 verziu

1. Backend business logiku z `code.js`
   - autentifikácia a scope resolving
   - dataset builders
   - dashboard cards / charts / table payload
   - summary hierarchy payload
   - notes, weekly overrides, save flow

2. Frontend 1:1 rendering
   - rozbiť `Index.html` na React komponenty bez zmeny DOM štruktúry tam, kde to je dôležité
   - rozbiť `sumar.html` na React komponenty rovnakým spôsobom
   - preniesť state machine a event handlers z inline scriptov do client komponentov

3. API kompatibilita
   - `/api/dashboard`
   - `/api/summary`
   - `/api/weekly-overrides`
   - `/api/dashboard/save`

## Praktická migrácia

Odporúčaný poradie implementácie:

1. `summary` route parity
2. `index` route parity bez editácie
3. notes modal
4. weekly compact + weekly overrides
5. save flow a roly VOD/VKL/GF/ADMIN

Tento dokument je pracovný anchor pre ďalšie portovanie. Cieľ je prestať dizajnovať novú verziu a migrovať starú aplikáciu do Next.js kompatibilne.
