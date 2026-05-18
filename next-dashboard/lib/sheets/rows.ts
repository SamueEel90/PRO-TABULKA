/**
 * Helpers for converting between Sheet rows (positional arrays) and
 * typed objects keyed by column name.
 *
 * Sheets API gives us `SheetRow[]` where row[0] is headers and row[1..] are
 * data. These helpers map that into `Record<string, unknown>` and back.
 */

import { SHEET_TABS, type SheetTabName } from './schema';
import type { SheetRow } from './client';

/**
 * Convert raw Sheet data (first row = headers, rest = data) into objects.
 * Validates that header order matches our schema — if not, throws so we
 * don't silently misalign columns after a manual edit.
 */
export function rowsToObjects<T = Record<string, unknown>>(
  tab: SheetTabName,
  data: SheetRow[],
): T[] {
  if (data.length === 0) return [];

  const def = SHEET_TABS[tab];
  const headers = data[0].map(v => String(v ?? ''));

  // Verify header alignment — case sensitive
  for (let i = 0; i < def.columns.length; i++) {
    if (headers[i] !== def.columns[i]) {
      throw new Error(
        `Sheet "${def.tab}" header mismatch at column ${i}: ` +
        `expected "${def.columns[i]}", got "${headers[i]}". ` +
        `Run sheets-init.mjs or fix the sheet manually.`,
      );
    }
  }

  const out: T[] = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    // Skip fully empty rows (Sheets sometimes pads)
    if (row.every(v => v === '' || v === null || v === undefined)) continue;

    const obj: Record<string, unknown> = {};
    for (let c = 0; c < def.columns.length; c++) {
      obj[def.columns[c]] = row[c] ?? null;
    }
    out.push(obj as T);
  }
  return out;
}

/**
 * Convert a typed object into a positional row for append/update ops.
 * Missing fields become empty strings.
 */
export function objectToRow(
  tab: SheetTabName,
  obj: Record<string, unknown>,
): SheetRow {
  const def = SHEET_TABS[tab];
  return def.columns.map(col => {
    const v = obj[col];
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v;
    return String(v);
  });
}
