// Diagnose duplicate rows in Google Sheets DB.
//
// Usage:
//   node scripts/sheets-find-dupes.mjs
//
// For each tab, lists rows that share an `id` (or composite unique key)
// with another row. Output includes the Sheet row number (1-based, header = row 1)
// so you can jump straight to the offender in the spreadsheet.

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

const TABS = [
  { tab: 'Store', idCol: 'id', composites: [] },
  { tab: 'Metric', idCol: 'code', composites: [] },
  { tab: 'Month', idCol: 'id', composites: [] },
  { tab: 'User', idCol: 'id', composites: [['email']] },
  { tab: 'ImportBatch', idCol: 'id', composites: [] },
  { tab: 'MonthlyValue', idCol: 'id', composites: [['source', 'storeId', 'metricCode', 'monthId']] },
  { tab: 'DashboardNote', idCol: 'id', composites: [['scopeKey', 'role', 'metricKey']] },
  { tab: 'NoteComment', idCol: 'id', composites: [] },
  { tab: 'TaskItem', idCol: 'id', composites: [] },
  { tab: 'ActivityEntry', idCol: 'id', composites: [] },
  { tab: 'UserLastSeen', idCol: 'id', composites: [['userId', 'scopeKey']] },
  { tab: 'IstAdjustmentRequest', idCol: 'id', composites: [] },
  { tab: 'WeeklyVodOverride', idCol: 'id', composites: [['storeId', 'metric', 'monthLabel', 'weekIndex']] },
];

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

function groupBy(items, keyFn) {
  const m = new Map();
  for (const item of items) {
    const k = keyFn(item);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

async function main() {
  console.log('Pulling all tabs...\n');
  const { data } = await callApi('readAll', { tabs: TABS.map(t => t.tab) });

  let totalDupes = 0;

  for (const { tab, idCol, composites } of TABS) {
    const rows = data[tab];
    if (!rows || rows.length <= 1) continue;
    const headers = rows[0].map(v => String(v ?? ''));
    const records = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.every(v => v === '' || v === null || v === undefined)) continue;
      const obj = { __sheetRow: r + 1 }; // 1-based, header is row 1
      for (let c = 0; c < headers.length; c++) {
        obj[headers[c]] = row[c];
      }
      records.push(obj);
    }

    const issues = [];

    // Duplicate id check
    const byId = groupBy(records, r => String(r[idCol] ?? ''));
    for (const [id, group] of byId) {
      if (!id) {
        if (group.length > 0) issues.push({ kind: 'blank-id', count: group.length, rows: group.map(g => g.__sheetRow) });
        continue;
      }
      if (group.length > 1) {
        issues.push({ kind: `dup-${idCol}`, key: id, rows: group.map(g => g.__sheetRow) });
      }
    }

    // Composite checks
    for (const cols of composites) {
      const byComp = groupBy(records, r => cols.map(c => String(r[c] ?? '')).join('::'));
      for (const [k, group] of byComp) {
        if (group.length > 1) {
          const ids = group.map(g => `row ${g.__sheetRow} (id=${g[idCol]})`);
          issues.push({ kind: `dup-composite[${cols.join(',')}]`, key: k, rows: ids });
        }
      }
    }

    if (issues.length === 0) continue;
    totalDupes += issues.length;
    console.log(`\n=== ${tab} — ${issues.length} duplicate group(s) ===`);
    for (const iss of issues) {
      console.log(`  ${iss.kind} ${iss.key ? `"${iss.key}"` : ''} → rows: ${JSON.stringify(iss.rows)}`);
    }
  }

  console.log(`\n\nTotal duplicate groups: ${totalDupes}`);
}

main().catch(err => {
  console.error('\nFAILED:', err.message || err);
  process.exit(1);
});
