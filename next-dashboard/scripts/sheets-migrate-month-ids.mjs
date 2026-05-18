// One-shot migration: convert ISO-datetime monthIds back to YYYY-MM format.
//
// Google Sheets locale auto-converted "2026-03" → "2026-02-28T23:00:00.000Z"
// in the Month.id column before we set Plain Text format on it. As a result,
// most MonthlyValue rows reference the ISO version. This script:
//
//   1. Builds canonical map: each Month row's monthNumber+year → "YYYY-MM"
//   2. Rewrites Month tab using YYYY-MM ids, deduping if needed
//   3. Rewrites MonthlyValue tab, remapping ISO monthIds and deduping
//      composite collisions (keep newest by updatedAt → createdAt)
//   4. Pushes both via bulkReplace (atomic per-tab rewrite)
//
// Usage:
//   node scripts/sheets-migrate-month-ids.mjs              # dry-run
//   node scripts/sheets-migrate-month-ids.mjs --execute    # actually write
//
// MAKE A BACKUP COPY OF THE SPREADSHEET FIRST (File → Make a copy in Drive).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function loadDotEnv() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const envPath = path.join(here, '..', '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {}
}
loadDotEnv();

const EXECUTE = process.argv.includes('--execute');

const MONTH_COLUMNS = ['id', 'label', 'year', 'monthNumber', 'businessYear', 'businessOrder', 'createdAt', 'updatedAt'];
const MONTHLY_VALUE_COLUMNS = ['id', 'source', 'storeId', 'metricCode', 'monthId', 'value', 'present', 'importedAt', 'importBatchId', 'createdAt', 'updatedAt'];
const SLOVAK_MONTHS = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december'];

async function callApi(op, payload = {}) {
  const res = await fetch(process.env.SHEETS_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.SHEETS_APPS_SCRIPT_SECRET, op, ...payload }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error);
  return data;
}

function rowsToObjects(rows, columns) {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0].map(v => String(v ?? ''));
  // Validate header alignment
  for (let i = 0; i < columns.length; i++) {
    if (headers[i] !== columns[i]) {
      throw new Error(`Header mismatch at col ${i}: expected "${columns[i]}", got "${headers[i]}"`);
    }
  }
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every(v => v === '' || v === null || v === undefined)) continue;
    const obj = { __sheetRow: r + 1 };
    for (let c = 0; c < columns.length; c++) {
      obj[columns[c]] = row[c];
    }
    out.push(obj);
  }
  return out;
}

function objectsToRows(objects, columns) {
  return objects.map(obj => columns.map(c => {
    const v = obj[c];
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.toISOString();
    return v;
  }));
}

function isYYYYMM(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}$/.test(s);
}

function canonicalMonthId(monthNumber, year) {
  const mn = Number(monthNumber);
  const yr = Number(year);
  if (mn < 1 || mn > 12 || !yr) return null;
  return `${yr}-${String(mn).padStart(2, '0')}`;
}

function canonicalLabel(monthNumber, year) {
  const mn = Number(monthNumber);
  const yr = Number(year);
  if (mn < 1 || mn > 12 || !yr) return null;
  return `${SLOVAK_MONTHS[mn - 1]} ${yr}`;
}

function toComparableTs(v) {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? 0 : t;
}

async function main() {
  console.log(`Mode: ${EXECUTE ? '*** EXECUTE (will write) ***' : 'DRY-RUN (no writes)'}\n`);

  console.log('1. Pulling Month + MonthlyValue tabs...');
  const { data } = await callApi('readAll', { tabs: ['Month', 'MonthlyValue'] });
  const monthRows = rowsToObjects(data.Month, MONTH_COLUMNS);
  const mvRows = rowsToObjects(data.MonthlyValue, MONTHLY_VALUE_COLUMNS);
  console.log(`   Month: ${monthRows.length} rows, MonthlyValue: ${mvRows.length} rows`);

  // --- Build ISO id → canonical YYYY-MM map from Month tab ---
  console.log('\n2. Building ISO → YYYY-MM mapping from Month tab...');
  const isoToCanonical = new Map();
  const unmappable = [];
  for (const m of monthRows) {
    const canonical = canonicalMonthId(m.monthNumber, m.year);
    if (!canonical) {
      unmappable.push(m);
      continue;
    }
    const currentId = String(m.id ?? '');
    if (currentId && currentId !== canonical) {
      isoToCanonical.set(currentId, canonical);
    }
  }
  console.log(`   Mapped ${isoToCanonical.size} distinct ISO ids → YYYY-MM:`);
  for (const [iso, canon] of isoToCanonical) {
    console.log(`     "${iso}" → "${canon}"`);
  }
  if (unmappable.length > 0) {
    console.log(`   ⚠ ${unmappable.length} Month row(s) without monthNumber/year — cannot map:`);
    for (const m of unmappable) console.log(`     row ${m.__sheetRow}: id="${m.id}"`);
  }

  // --- Build new Month tab (deduped by canonical id, prefer YYYY-MM original, fix label) ---
  console.log('\n3. Building new Month tab (deduped to canonical YYYY-MM rows)...');
  const monthByCanonical = new Map();
  for (const m of monthRows) {
    const canonical = canonicalMonthId(m.monthNumber, m.year);
    if (!canonical) continue;
    const existing = monthByCanonical.get(canonical);
    const isCleanId = String(m.id ?? '') === canonical;
    const existingClean = existing && String(existing.id ?? '') === canonical;
    // Prefer: clean YYYY-MM id > newer updatedAt
    let winner;
    if (!existing) winner = m;
    else if (isCleanId && !existingClean) winner = m;
    else if (!isCleanId && existingClean) winner = existing;
    else winner = toComparableTs(m.updatedAt) >= toComparableTs(existing.updatedAt) ? m : existing;
    monthByCanonical.set(canonical, winner);
  }
  // Sort by businessOrder for readability
  const newMonth = [...monthByCanonical.entries()]
    .map(([canonical, m]) => ({
      ...m,
      id: canonical,
      label: canonicalLabel(m.monthNumber, m.year) || m.label,
    }))
    .sort((a, b) => Number(a.businessOrder ?? 0) - Number(b.businessOrder ?? 0));
  console.log(`   ${monthRows.length} rows → ${newMonth.length} canonical rows`);
  for (const m of newMonth) {
    console.log(`     ${m.id}  ${m.label}  (businessOrder=${m.businessOrder})`);
  }

  // --- Build new MonthlyValue tab (remap monthId, dedupe composite collisions) ---
  console.log('\n4. Remapping MonthlyValue.monthId and deduping composite collisions...');
  let remappedCount = 0;
  const remapped = mvRows.map(r => {
    const mid = String(r.monthId ?? '');
    const canon = isoToCanonical.get(mid);
    if (canon && canon !== mid) {
      remappedCount++;
      return { ...r, monthId: canon };
    }
    return r;
  });

  // Dedupe by composite (source, storeId, metricCode, monthId) — keep newest
  const byComposite = new Map();
  for (const r of remapped) {
    const k = `${r.source}::${r.storeId}::${r.metricCode}::${r.monthId}`;
    const existing = byComposite.get(k);
    if (!existing) {
      byComposite.set(k, r);
    } else {
      const newer = toComparableTs(r.updatedAt) > toComparableTs(existing.updatedAt) ||
                    (toComparableTs(r.updatedAt) === toComparableTs(existing.updatedAt) &&
                     toComparableTs(r.createdAt) > toComparableTs(existing.createdAt));
      if (newer) byComposite.set(k, r);
    }
  }
  const newMV = [...byComposite.values()];
  const dedupeDropped = remapped.length - newMV.length;
  console.log(`   Remapped monthId on ${remappedCount} row(s)`);
  console.log(`   Composite-dedup dropped ${dedupeDropped} row(s)`);
  console.log(`   Final MonthlyValue: ${newMV.length} rows (was ${mvRows.length})`);

  // --- Sanity check: every MV.monthId should now exist in newMonth ---
  console.log('\n5. Sanity check: MonthlyValue.monthId references...');
  const validMonthIds = new Set(newMonth.map(m => m.id));
  const orphanIds = new Map();
  for (const r of newMV) {
    const mid = String(r.monthId ?? '');
    if (!validMonthIds.has(mid)) {
      orphanIds.set(mid, (orphanIds.get(mid) || 0) + 1);
    }
  }
  if (orphanIds.size > 0) {
    console.log(`   ⚠ ${orphanIds.size} distinct orphan monthId(s) — these MV rows will be unreachable:`);
    for (const [mid, count] of orphanIds) {
      console.log(`     "${mid}": ${count} row(s)`);
    }
  } else {
    console.log(`   OK — every MonthlyValue row references a valid Month id`);
  }

  // --- Write or skip ---
  if (!EXECUTE) {
    console.log('\n=== DRY-RUN. No changes written. Re-run with --execute to apply. ===');
    return;
  }

  console.log('\n6. Writing Month tab via bulkReplace...');
  await callApi('bulkReplace', {
    tab: 'Month',
    headers: MONTH_COLUMNS,
    rows: objectsToRows(newMonth, MONTH_COLUMNS),
  });
  console.log(`   ${newMonth.length} rows written`);

  console.log('\n7. Writing MonthlyValue tab via bulkReplace...');
  await callApi('bulkReplace', {
    tab: 'MonthlyValue',
    headers: MONTHLY_VALUE_COLUMNS,
    rows: objectsToRows(newMV, MONTHLY_VALUE_COLUMNS),
  });
  console.log(`   ${newMV.length} rows written`);

  console.log('\nDone. Next: run `npm run sheets:pull` to rebuild SQLite cache.');
}

main().catch(err => {
  console.error('\nFAILED:', err.stack || err.message || err);
  process.exit(1);
});
