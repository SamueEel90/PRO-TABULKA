// Initialize and verify the Google Sheets backend.
//
// What it does:
//   1. Pings the Apps Script Web App (auth check)
//   2. Lists existing tabs in the spreadsheet
//   3. Creates any missing tabs with proper headers (idempotent)
//   4. Re-lists to confirm
//
// Usage:
//   node scripts/sheets-init.mjs
//
// Requires SHEETS_APPS_SCRIPT_URL and SHEETS_APPS_SCRIPT_SECRET in .env

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Minimal .env loader — avoid adding dotenv as a dependency just for scripts.
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
  } catch {
    // .env not present — rely on process.env from shell
  }
}
loadDotEnv();

const SHEET_TABS = [
  { name: 'Store', columns: ['id', 'name', 'gfName', 'vklName', 'createdAt', 'updatedAt'] },
  { name: 'User', columns: ['id', 'email', 'passwordHash', 'name', 'role', 'gfName', 'vklName', 'primaryStoreId', 'active', 'lastLoginAt', 'createdAt', 'updatedAt'] },
  { name: 'Metric', columns: ['code', 'displayName', 'unit', 'aggregation', 'createdAt', 'updatedAt'] },
  { name: 'Month', columns: ['id', 'label', 'year', 'monthNumber', 'businessYear', 'businessOrder', 'createdAt', 'updatedAt'] },
  { name: 'ImportBatch', columns: ['id', 'source', 'fileName', 'uploadedBy', 'status', 'rowCount', 'monthId', 'createdAt'] },
  { name: 'MonthlyValue', columns: ['id', 'source', 'storeId', 'metricCode', 'monthId', 'value', 'present', 'importedAt', 'importBatchId', 'createdAt', 'updatedAt'] },
  { name: 'DashboardNote', columns: ['id', 'scopeKey', 'scopeType', 'scopeId', 'scopeLabel', 'metricKey', 'role', 'author', 'text', 'storeId', 'createdAt', 'updatedAt'] },
  { name: 'NoteComment', columns: ['id', 'scopeKey', 'metricKey', 'role', 'author', 'text', 'createdAt'] },
  { name: 'TaskItem', columns: ['id', 'scopeKey', 'metricKey', 'monthLabel', 'text', 'status', 'createdByRole', 'createdByName', 'createdAt', 'completedByName', 'completedAt', 'sourceCommentId'] },
  { name: 'ActivityEntry', columns: ['id', 'scopeKey', 'actorRole', 'actorName', 'action', 'metricKey', 'monthLabel', 'detail', 'createdAt'] },
  { name: 'UserLastSeen', columns: ['id', 'userId', 'scopeKey', 'lastSeenAt'] },
  { name: 'IstAdjustmentRequest', columns: ['id', 'storeId', 'metricCode', 'monthId', 'monthLabel', 'oldValue', 'newValue', 'reason', 'status', 'requestedById', 'requestedByName', 'vklName', 'decidedAt', 'decidedById', 'decidedByName', 'decisionNote', 'createdAt', 'updatedAt'] },
  { name: 'WeeklyVodOverride', columns: ['id', 'storeId', 'metric', 'monthLabel', 'weekIndex', 'weekLabel', 'rangeLabel', 'value', 'distributionMode', 'updatedBy', 'createdAt', 'updatedAt'] },
];

async function callApi(op, payload = {}) {
  const url = process.env.SHEETS_APPS_SCRIPT_URL;
  const secret = process.env.SHEETS_APPS_SCRIPT_SECRET;

  if (!url || !secret) {
    throw new Error('Missing SHEETS_APPS_SCRIPT_URL or SHEETS_APPS_SCRIPT_SECRET in .env');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, op, ...payload }),
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from Apps Script`);
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Apps Script error: ${data.error}`);
  }
  return data;
}

async function main() {
  console.log('1. Pinging Apps Script Web App...');
  const ping = await callApi('ping');
  console.log(`   OK — server time: ${ping.time}`);

  console.log('\n2. Listing existing tabs...');
  const before = await callApi('listTabs');
  console.log(`   Found ${before.tabs.length} tab(s): ${before.tabs.join(', ') || '(none)'}`);

  console.log('\n3. Ensuring all schema tabs exist (with header rows)...');
  // Apps Script expects `headers` field, not `columns`. Map first.
  await callApi('ensureTabs', {
    tabs: SHEET_TABS.map(t => ({ name: t.name, headers: t.columns })),
  });
  console.log(`   OK — ${SHEET_TABS.length} tabs ensured`);

  console.log('\n3b. Repairing missing header rows (if any tabs were created without them)...');
  let repaired = 0;
  for (const t of SHEET_TABS) {
    const { data } = await callApi('read', { tab: t.name });
    const firstRow = (data?.[0] ?? []).map(v => String(v ?? ''));
    const headerOk = t.columns.every((c, i) => firstRow[i] === c);
    if (!headerOk) {
      // Preserve any existing data rows. If row 0 looks like real data (not headers),
      // keep it as a data row after the header gets written.
      const looksLikeData = firstRow.length > 0 && firstRow.some(v => v && !t.columns.includes(v));
      const dataRows = looksLikeData ? [firstRow.slice(0, t.columns.length)] : [];
      const restRows = data.slice(1).filter(r => r.some(v => v !== '' && v !== null && v !== undefined));
      await callApi('bulkReplace', {
        tab: t.name,
        headers: t.columns,
        rows: [...dataRows, ...restRows],
      });
      repaired++;
      console.log(`     repaired headers for ${t.name} (preserved ${dataRows.length + restRows.length} data row(s))`);
    }
  }
  if (repaired === 0) console.log(`   All tabs already have correct headers`);

  console.log('\n4. Re-listing tabs...');
  const after = await callApi('listTabs');
  console.log(`   Found ${after.tabs.length} tab(s):`);
  for (const t of after.tabs) {
    const isSchema = SHEET_TABS.some(s => s.name === t);
    console.log(`     - ${t}${isSchema ? '' : ' (extra, not in schema)'}`);
  }

  const missing = SHEET_TABS.filter(s => !after.tabs.includes(s.name));
  if (missing.length > 0) {
    console.error(`\nERROR: ${missing.length} tab(s) still missing after ensure: ${missing.map(m => m.name).join(', ')}`);
    process.exit(1);
  }

  console.log('\nDone. Spreadsheet is ready.');
}

main().catch(err => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
