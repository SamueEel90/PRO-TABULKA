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

import { sheets } from './client';
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
  await sheets.append(tab, objectToRow(tab, record));
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
  await sheets.updateById(tab, String(id), objectToRow(tab, record));
}

/** Delete a row by id. */
export async function pushDelete(
  tab: SheetTabName,
  id: string,
): Promise<void> {
  await sheets.deleteById(tab, id);
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
  await sheets.bulkReplace(tab, rows);
}

/**
 * Append many rows. Calls Sheets append in sequence — Apps Script doesn't
 * expose a batch append op, so this is N round trips. For large batches
 * (>50 rows) prefer pushBulkReplace if it makes sense to wipe the tab first.
 */
export async function pushBulkAppend(
  tab: SheetTabName,
  records: Record<string, unknown>[],
): Promise<void> {
  for (const r of records) {
    await pushNew(tab, r);
  }
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
      await sheets.bulkReplace(tab, rows, { expectedModifiedTime: modifiedTime });
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
