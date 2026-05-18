// Force-rebuild the local SQLite cache from Google Sheets.
//
// Usage:
//   node scripts/sheets-pull.mjs
//
// Self-contained — duplicates the schema/coercion from lib/sheets/schema.ts
// and lib/db/bootstrap.ts so we don't need ts-node/tsx.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

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

const TABS = {
  Store: { delegate: 'store', columns: ['id', 'name', 'gfName', 'vklName', 'createdAt', 'updatedAt'] },
  Metric: { delegate: 'metric', columns: ['code', 'displayName', 'unit', 'aggregation', 'createdAt', 'updatedAt'] },
  Month: { delegate: 'month', columns: ['id', 'label', 'year', 'monthNumber', 'businessYear', 'businessOrder', 'createdAt', 'updatedAt'] },
  User: { delegate: 'user', columns: ['id', 'email', 'passwordHash', 'name', 'role', 'gfName', 'vklName', 'primaryStoreId', 'active', 'lastLoginAt', 'createdAt', 'updatedAt'] },
  ImportBatch: { delegate: 'importBatch', columns: ['id', 'source', 'fileName', 'uploadedBy', 'status', 'rowCount', 'monthId', 'createdAt'] },
  MonthlyValue: { delegate: 'monthlyValue', columns: ['id', 'source', 'storeId', 'metricCode', 'monthId', 'value', 'present', 'importedAt', 'importBatchId', 'createdAt', 'updatedAt'] },
  DashboardNote: { delegate: 'dashboardNote', columns: ['id', 'scopeKey', 'scopeType', 'scopeId', 'scopeLabel', 'metricKey', 'role', 'author', 'text', 'storeId', 'createdAt', 'updatedAt'] },
  NoteComment: { delegate: 'noteComment', columns: ['id', 'scopeKey', 'metricKey', 'role', 'author', 'text', 'createdAt'] },
  TaskItem: { delegate: 'taskItem', columns: ['id', 'scopeKey', 'metricKey', 'monthLabel', 'text', 'status', 'createdByRole', 'createdByName', 'createdAt', 'completedByName', 'completedAt', 'sourceCommentId'] },
  ActivityEntry: { delegate: 'activityEntry', columns: ['id', 'scopeKey', 'actorRole', 'actorName', 'action', 'metricKey', 'monthLabel', 'detail', 'createdAt'] },
  UserLastSeen: { delegate: 'userLastSeen', columns: ['id', 'userId', 'scopeKey', 'lastSeenAt'] },
  IstAdjustmentRequest: { delegate: 'istAdjustmentRequest', columns: ['id', 'storeId', 'metricCode', 'monthId', 'monthLabel', 'oldValue', 'newValue', 'reason', 'status', 'requestedById', 'requestedByName', 'vklName', 'decidedAt', 'decidedById', 'decidedByName', 'decisionNote', 'createdAt', 'updatedAt'] },
  WeeklyVodOverride: { delegate: 'weeklyVodOverride', columns: ['id', 'storeId', 'metric', 'monthLabel', 'weekIndex', 'weekLabel', 'rangeLabel', 'value', 'distributionMode', 'updatedBy', 'createdAt', 'updatedAt'] },
};

const LOAD_ORDER = ['Store', 'Metric', 'Month', 'User', 'ImportBatch', 'MonthlyValue', 'DashboardNote', 'NoteComment', 'TaskItem', 'ActivityEntry', 'UserLastSeen', 'IstAdjustmentRequest', 'WeeklyVodOverride'];

const DATETIME_COLS = new Set(['createdAt', 'updatedAt', 'importedAt', 'lastLoginAt', 'lastSeenAt', 'completedAt', 'decidedAt', 'emailVerified']);
const FLOAT_COLS = new Set(['value', 'oldValue', 'newValue']);
const INT_COLS = new Set(['year', 'monthNumber', 'businessYear', 'businessOrder', 'rowCount', 'weekIndex', 'expires_at']);
const BOOL_COLS = new Set(['present', 'active']);

const SLOVAK_MONTHS = ['január','február','marec','apríl','máj','jún','júl','august','september','október','november','december'];

function coerce(col, raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (DATETIME_COLS.has(col)) {
    const d = new Date(String(raw));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (FLOAT_COLS.has(col)) {
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
    return Number.isNaN(n) ? 0 : n;
  }
  if (INT_COLS.has(col)) {
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    return Number.isNaN(n) ? 0 : n;
  }
  if (BOOL_COLS.has(col)) {
    if (typeof raw === 'boolean') return raw;
    const s = String(raw).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return String(raw);
}

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

async function main() {
  console.log('1. Pulling all tabs from Sheets...');
  const { data } = await callApi('readAll', { tabs: LOAD_ORDER });
  const { modifiedTime } = await callApi('modifiedTime');
  console.log(`   Source modifiedTime: ${modifiedTime}`);

  const prisma = new PrismaClient();
  try {
    console.log('\n2. Wiping local cache tables (reverse FK order)...');
    for (const tab of [...LOAD_ORDER].reverse()) {
      await prisma[TABS[tab].delegate].deleteMany({});
    }

    console.log('\n3. Inserting data (FK order)...');
    let totalRows = 0;
    for (const tab of LOAD_ORDER) {
      const def = TABS[tab];
      const rows = data[tab];
      if (!rows || rows.length <= 1) {
        console.log(`   ${tab}: 0 rows (empty)`);
        continue;
      }
      const headers = rows[0].map(v => String(v ?? ''));
      // Validate header alignment
      for (let i = 0; i < def.columns.length; i++) {
        if (headers[i] !== def.columns[i]) {
          throw new Error(`${tab} header mismatch at col ${i}: expected "${def.columns[i]}", got "${headers[i]}"`);
        }
      }
      const records = [];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (row.every(v => v === '' || v === null || v === undefined)) continue;
        const obj = {};
        for (let c = 0; c < def.columns.length; c++) {
          obj[def.columns[c]] = coerce(def.columns[c], row[c]);
        }
        // Month: always rebuild label from monthNumber+year (Sheets locale auto-converts
        // certain Slovak month names like "máj 2026" back to dates).
        if (tab === 'Month') {
          const mn = Number(obj.monthNumber);
          const yr = Number(obj.year);
          if (mn >= 1 && mn <= 12 && yr) obj.label = `${SLOVAK_MONTHS[mn - 1]} ${yr}`;
        }
        records.push(obj);
      }
      // Dedupe by id column — if Sheet has duplicates, last one wins
      const idCol = def.columns[0];
      const dedup = new Map();
      for (const r of records) {
        const k = String(r[idCol] ?? '');
        if (!k) continue;
        dedup.set(k, r);
      }
      const deduped = [...dedup.values()];
      const dropped = records.length - deduped.length;
      if (deduped.length > 0) {
        await prisma[def.delegate].createMany({ data: deduped });
      }
      console.log(`   ${tab}: ${deduped.length} rows${dropped > 0 ? ` (dropped ${dropped} duplicates)` : ''}`);
      totalRows += deduped.length;
    }

    console.log(`\n4. Writing cache meta...`);
    const metaPath = path.resolve(process.cwd(), 'prisma', 'dev.cache.meta.json');
    mkdirSync(path.dirname(metaPath), { recursive: true });
    writeFileSync(metaPath, JSON.stringify({
      builtAt: new Date().toISOString(),
      sourceModifiedTime: modifiedTime,
      schemaVersion: 1,
    }, null, 2));

    console.log(`\nDone. ${totalRows} total rows loaded into SQLite cache.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('\nFAILED:', err.message || err);
  process.exit(1);
});
