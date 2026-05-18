// Diagnose monthId formats used across the database.
// Counts distinct monthId values in MonthlyValue / ImportBatch / IstAdjustmentRequest
// and groups them by format (YYYY-MM vs ISO datetime vs other).
//
// Usage: node scripts/sheets-check-month-refs.mjs

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

function classify(v) {
  if (v === '' || v === null || v === undefined) return 'empty';
  const s = String(v);
  if (/^\d{4}-\d{2}$/.test(s)) return 'YYYY-MM';
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return 'ISO datetime';
  if (s instanceof Date || !Number.isNaN(Date.parse(s))) return 'date-like';
  return `other (${s.slice(0, 30)})`;
}

async function analyzeTab(tab, colName) {
  const { data } = await callApi('read', { tab });
  if (!data || data.length <= 1) {
    console.log(`\n${tab}: empty`);
    return;
  }
  const headers = data[0].map(v => String(v ?? ''));
  const colIdx = headers.indexOf(colName);
  if (colIdx === -1) {
    console.log(`\n${tab}: column '${colName}' not found`);
    return;
  }

  const buckets = new Map();
  const examples = new Map();
  let total = 0;
  for (let r = 1; r < data.length; r++) {
    const v = data[r][colIdx];
    if (data[r].every(c => c === '' || c === null || c === undefined)) continue;
    total++;
    const cls = classify(v);
    buckets.set(cls, (buckets.get(cls) || 0) + 1);
    if (!examples.has(cls)) examples.set(cls, String(v));
  }

  console.log(`\n=== ${tab}.${colName} — ${total} rows ===`);
  for (const [cls, count] of [...buckets.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cls}: ${count}  (e.g. "${examples.get(cls)}")`);
  }
}

async function main() {
  console.log('Pulling data...');
  await analyzeTab('Month', 'id');
  await analyzeTab('MonthlyValue', 'monthId');
  await analyzeTab('ImportBatch', 'monthId');
  await analyzeTab('IstAdjustmentRequest', 'monthId');
}

main().catch(err => {
  console.error('FAILED:', err.message || err);
  process.exit(1);
});
