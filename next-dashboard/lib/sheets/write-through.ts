/**
 * Write-through helpers for keeping Google Sheets and the local SQLite cache
 * in sync.
 *
 * Pattern (per route):
 *   1. Build a fully-populated record (id + createdAt + updatedAt assigned
 *      client-side so the same values land in both stores).
 *   2. `await pushNew(tab, record)` — pushes to Sheets. Throws on failure.
 *   3. `await prisma.<model>.create({ data: record })` — writes to local cache.
 *
 * The Sheets push runs FIRST so a failure aborts before the local cache
 * diverges. If the local cache write fails after Sheets succeeds, the next
 * cache rebuild will pick up the row anyway — eventual consistency.
 *
 * For updates/deletes the same ordering applies.
 */

import { randomUUID } from 'node:crypto';

import { recordLocalWrite } from '@/lib/db/bootstrap';
import { sheets, type BatchSubOpPayload } from './client';
import { objectToRow, rowsToObjects } from './rows';
import { SHEET_TABS, type SheetTabName } from './schema';

/** Generate a new id (used where Prisma would normally `@default(cuid())`). */
export function newId(): string {
  return randomUUID();
}

/** ISO timestamp for `createdAt` / `updatedAt` fields. */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Push a freshly-built record into the Sheet. The record MUST contain every
 * column the schema declares — missing fields become empty strings.
 */
export async function pushNew(
  tab: SheetTabName,
  record: Record<string, unknown>,
): Promise<void> {
  const def = SHEET_TABS[tab];
  // Quick sanity check — id column must be present
  if (record[def.idColumn] === undefined || record[def.idColumn] === null || record[def.idColumn] === '') {
    throw new Error(`pushNew(${tab}): record is missing required id column "${def.idColumn}"`);
  }
  const { tabTime } = await sheets.append(tab, objectToRow(tab, record));
  recordLocalWrite(tab, tabTime);
}

/** Update an existing row by id. Pass the full updated record. */
export async function pushUpdate(
  tab: SheetTabName,
  record: Record<string, unknown>,
): Promise<void> {
  const def = SHEET_TABS[tab];
  const id = record[def.idColumn];
  if (id === undefined || id === null || id === '') {
    throw new Error(`pushUpdate(${tab}): record is missing id column "${def.idColumn}"`);
  }
  const { tabTime } = await sheets.updateById(tab, String(id), objectToRow(tab, record));
  recordLocalWrite(tab, tabTime);
}

/** Delete a row by id. */
export async function pushDelete(
  tab: SheetTabName,
  id: string,
): Promise<void> {
  const { tabTime } = await sheets.deleteById(tab, id);
  recordLocalWrite(tab, tabTime);
}

/**
 * Delete N rows by id in a single Apps Script call.
 *
 * Use this for delete-slice patterns when the caller can resolve the
 * matching ids upfront (e.g. by querying the local Prisma cache). Way
 * cheaper than `pushBulkReplaceSlice` for small N because it doesn't
 * rewrite the whole tab — no full-tab clearContents flicker either.
 *
 * Idempotent: ids not present in the sheet are silently skipped.
 */
export async function pushBulkDelete(
  tab: SheetTabName,
  ids: string[],
): Promise<{ deleted: number }> {
  if (ids.length === 0) return { deleted: 0 };
  const { tabTime, ...rest } = await sheets.bulkDeleteByIds(tab, ids);
  recordLocalWrite(tab, tabTime);
  return rest;
}

/**
 * Replace the entire tab with `records`. Use for bulk imports (IST upload,
 * structure-users upload, resets). Atomic from the Sheet's perspective — one
 * API call clears the tab and writes header + all rows.
 */
export async function pushBulkReplace(
  tab: SheetTabName,
  records: Record<string, unknown>[],
): Promise<void> {
  const rows = records.map(r => objectToRow(tab, r));
  const { tabTime } = await sheets.bulkReplace(tab, rows);
  recordLocalWrite(tab, tabTime);
}

/**
 * Append many rows in a single Apps Script call. Backed by the `bulkAppend`
 * op which uses one `setValues` to write all rows — orders of magnitude
 * faster than per-row appends when inserting large batches (activity log
 * entries from a batch save, etc.).
 *
 * Each record MUST contain every schema column (id included) just like
 * `pushNew`.
 */
export async function pushBulkAppend(
  tab: SheetTabName,
  records: Record<string, unknown>[],
): Promise<void> {
  if (records.length === 0) return;
  const def = SHEET_TABS[tab];
  for (const r of records) {
    if (r[def.idColumn] === undefined || r[def.idColumn] === null || r[def.idColumn] === '') {
      throw new Error(`pushBulkAppend(${tab}): record is missing required id column "${def.idColumn}"`);
    }
  }
  const rows = records.map(r => objectToRow(tab, r));
  const { tabTime } = await sheets.bulkAppend(tab, rows);
  recordLocalWrite(tab, tabTime);
}

/**
 * Upsert many rows by id in a single Apps Script call.
 *
 * Backed by the `bulkUpsertById` op: existing ids are updated in place,
 * new ids are appended. Idempotent — safe to retry on network/lock errors.
 *
 * Use this instead of `pushBulkReplaceSlice` when the write target is a
 * fixed set of id-keyed rows. bulkReplaceSlice reads + rewrites the entire
 * tab (slow for big tabs like MonthlyValue with 27k rows); bulkUpsertById
 * only touches the affected rows.
 */
export async function pushBulkUpsert(
  tab: SheetTabName,
  records: Record<string, unknown>[],
): Promise<{ updated: number; inserted: number }> {
  if (records.length === 0) return { updated: 0, inserted: 0 };
  const def = SHEET_TABS[tab];
  for (const r of records) {
    if (r[def.idColumn] === undefined || r[def.idColumn] === null || r[def.idColumn] === '') {
      throw new Error(`pushBulkUpsert(${tab}): record is missing required id column "${def.idColumn}"`);
    }
  }
  const rows = records.map(r => objectToRow(tab, r));
  const { tabTime, ...rest } = await sheets.bulkUpsertById(tab, rows);
  recordLocalWrite(tab, tabTime);
  return rest;
}

/**
 * Update a "slice" of a tab in one round-trip: download all rows, remove the
 * ones matching `predicate`, append `newRecords`, then bulkReplace the tab.
 *
 * Used by endpoints that do `DELETE WHERE source=X AND storeId=Y; INSERT ...`
 * patterns. Without this helper that would be N+M round trips; with it, 2.
 *
 * Caller passes a predicate over Record<string, unknown> — strings are the
 * raw cell values from Sheets.
 *
 * Concurrency: captures the spreadsheet's modifiedTime before reading and
 * passes it to bulkReplace as expectedModifiedTime. If another writer touched
 * the spreadsheet between read and write, Apps Script rejects with "Conflict:"
 * and we retry from scratch (up to 3 attempts). This prevents lost updates
 * when two admins do bulk operations concurrently.
 */
export async function pushBulkReplaceSlice(
  tab: SheetTabName,
  predicate: (row: Record<string, unknown>) => boolean,
  newRecords: Record<string, unknown>[],
): Promise<void> {
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { modifiedTime } = await sheets.modifiedTime();
      const { data } = await sheets.read(tab);
      const existing = rowsToObjects(tab, data);
      const kept = existing.filter(r => !predicate(r as Record<string, unknown>));
      const combined = [...kept, ...newRecords];
      const rows = combined.map(r => objectToRow(tab, r));
      const { tabTime } = await sheets.bulkReplace(tab, rows, { expectedModifiedTime: modifiedTime });
      recordLocalWrite(tab, tabTime);
      return;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Only retry on conflict; other errors abort immediately.
      if (!msg.includes('Conflict:')) throw err;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 200 * attempt));
      }
    }
  }
  throw lastErr;
}

/**
 * High-level batch op. Caller builds a list of sub-ops in record form
 * (e.g. `{ op: 'bulkUpsertById', tab: 'MonthlyValue', records: [...] }`)
 * and `pushBatch` translates each into the wire payload, validates ids,
 * sends them as ONE `sheets.batch` call, and records local writes for
 * every successful sub-op.
 *
 * Use this to collapse a save flow that would otherwise do 4-8 separate
 * Apps Script calls into a single round-trip + a single LockService
 * acquisition — typically ~5× faster end-to-end, dramatically better
 * under concurrent load.
 */
export type BatchOp =
  | { op: 'bulkUpsertById'; tab: SheetTabName; records: Record<string, unknown>[] }
  | { op: 'bulkAppend'; tab: SheetTabName; records: Record<string, unknown>[] }
  | { op: 'bulkDeleteByIds'; tab: SheetTabName; ids: string[] };

export async function pushBatch(ops: BatchOp[]): Promise<void> {
  // Skip empty ops (no records / no ids) — they're free no-ops, no point
  // burdening the batch.
  const nonEmpty = ops.filter(op => {
    if (op.op === 'bulkDeleteByIds') return op.ids.length > 0;
    return op.records.length > 0;
  });
  if (nonEmpty.length === 0) return;

  // Translate to wire payloads + validate ids in upsert/append records.
  const apiOps: BatchSubOpPayload[] = nonEmpty.map(op => {
    const def = SHEET_TABS[op.tab];
    switch (op.op) {
      case 'bulkUpsertById': {
        for (const r of op.records) {
          if (r[def.idColumn] === undefined || r[def.idColumn] === null || r[def.idColumn] === '') {
            throw new Error(`pushBatch(${op.op}, ${op.tab}): record missing id column "${def.idColumn}"`);
          }
        }
        return {
          op: 'bulkUpsertById',
          tab: def.tab,
          idColumn: def.idColumn,
          headers: def.columns,
          rows: op.records.map(r => objectToRow(op.tab, r)),
        };
      }
      case 'bulkAppend': {
        for (const r of op.records) {
          if (r[def.idColumn] === undefined || r[def.idColumn] === null || r[def.idColumn] === '') {
            throw new Error(`pushBatch(${op.op}, ${op.tab}): record missing id column "${def.idColumn}"`);
          }
        }
        return {
          op: 'bulkAppend',
          tab: def.tab,
          headers: def.columns,
          rows: op.records.map(r => objectToRow(op.tab, r)),
        };
      }
      case 'bulkDeleteByIds':
        return {
          op: 'bulkDeleteByIds',
          tab: def.tab,
          idColumn: def.idColumn,
          ids: op.ids,
        };
    }
  });

  const { results } = await sheets.batch(apiOps);

  // Each successful result: record the localWrite so our same-lambda
  // ensureFresh diff sees the upstream timestamp we already know about.
  // First failure (if any): throw with context.
  for (let i = 0; i < apiOps.length; i++) {
    const result = results[i];
    if (!result) {
      throw new Error(`pushBatch: sub-op ${i} (${nonEmpty[i].op} on ${nonEmpty[i].tab}) was not executed`);
    }
    if (!result.ok) {
      throw new Error(
        `pushBatch: sub-op ${i} (${nonEmpty[i].op} on ${nonEmpty[i].tab}) failed: ${result.error}`,
      );
    }
    if (result.tabTime) recordLocalWrite(nonEmpty[i].tab, result.tabTime);
  }
}
