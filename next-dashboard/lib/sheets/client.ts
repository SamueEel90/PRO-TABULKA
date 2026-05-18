/**
 * HTTP client for the Google Apps Script Web App backing PRO_TABULKA_DB.
 *
 * All ops POST to the same endpoint with `{ secret, op, ...args }` body.
 * Apps Script auths via shared secret and dispatches by `op`.
 *
 * Do not import this from React client components. Server-side only.
 */

import { secrets } from '@/lib/secrets';
import { ALL_TABS, SHEET_TABS, type SheetTabName } from './schema';

type SheetCellValue = string | number | boolean | null;
export type SheetRow = SheetCellValue[];

type ApiOk<T> = { ok: true } & T;
type ApiErr = { ok: false; error: string };
type ApiResponse<T> = ApiOk<T> | ApiErr;

class SheetsApiError extends Error {
  constructor(message: string, readonly op: string, readonly status?: number) {
    super(`[Sheets:${op}] ${message}`);
    this.name = 'SheetsApiError';
  }
}

async function call<T>(op: string, payload: Record<string, unknown> = {}): Promise<T> {
  const url = secrets.required('SHEETS_APPS_SCRIPT_URL');
  const secret = secrets.required('SHEETS_APPS_SCRIPT_SECRET');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, op, ...payload }),
    redirect: 'follow',
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new SheetsApiError(`HTTP ${res.status}`, op, res.status);
  }

  const data = (await res.json()) as ApiResponse<T>;
  if (!data.ok) {
    throw new SheetsApiError(data.error, op);
  }
  // Strip the `ok: true` field for ergonomics
  const { ok: _ok, ...rest } = data;
  return rest as T;
}

export const sheets = {
  /** Cheap health check — round-trip to Apps Script */
  ping(): Promise<{ time: string }> {
    return call('ping');
  },

  /** Spreadsheet last-modified timestamp (ISO). Used for cache freshness. */
  modifiedTime(): Promise<{ modifiedTime: string }> {
    return call('modifiedTime');
  },

  /** List of existing tab names in the spreadsheet */
  listTabs(): Promise<{ tabs: string[] }> {
    return call('listTabs');
  },

  /**
   * Create any missing tabs with their headers. Idempotent.
   * Called during bootstrap to ensure the spreadsheet matches our schema.
   */
  ensureTabs(): Promise<void> {
    return call('ensureTabs', {
      tabs: ALL_TABS.map(t => ({ name: t.tab, headers: t.columns })),
    }).then(() => undefined);
  },

  /** Read all rows from one tab. First row is headers. */
  read(tab: SheetTabName): Promise<{ data: SheetRow[] }> {
    return call('read', { tab: SHEET_TABS[tab].tab });
  },

  /** Read all rows from multiple tabs in one round-trip. */
  readAll(tabs: SheetTabName[]): Promise<{ data: Record<string, SheetRow[]> }> {
    return call('readAll', { tabs: tabs.map(t => SHEET_TABS[t].tab) });
  },

  /** Append one row. Row values must be in column order. */
  append(tab: SheetTabName, row: SheetRow): Promise<void> {
    const def = SHEET_TABS[tab];
    return call('append', { tab: def.tab, headers: def.columns, row })
      .then(() => undefined);
  },

  /** Update row by id. Row must contain all columns in order. */
  updateById(tab: SheetTabName, id: string, row: SheetRow): Promise<void> {
    const def = SHEET_TABS[tab];
    return call('updateById', { tab: def.tab, idColumn: def.idColumn, id, row })
      .then(() => undefined);
  },

  /** Delete row by id. */
  deleteById(tab: SheetTabName, id: string): Promise<void> {
    const def = SHEET_TABS[tab];
    return call('deleteById', { tab: def.tab, idColumn: def.idColumn, id })
      .then(() => undefined);
  },

  /** Replace all rows in a tab. Use sparingly — full rewrite. */
  bulkReplace(tab: SheetTabName, rows: SheetRow[]): Promise<void> {
    const def = SHEET_TABS[tab];
    return call('bulkReplace', { tab: def.tab, headers: def.columns, rows })
      .then(() => undefined);
  },
};

export { SheetsApiError };
