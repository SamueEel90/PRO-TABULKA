/**
 * HTTP client for the Google Apps Script Web App backing PRO_TABULKA_DB.
 *
 * All ops POST to the same endpoint with `{ secret, op, ...args }` body.
 * Apps Script auths via shared secret and dispatches by `op`.
 *
 * Do not import this from React client components. Server-side only.
 */

import { logger } from '@/lib/logger';
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

/**
 * Ops safe to retry without risking duplicate side-effects.
 *
 * Read ops are obviously idempotent. `bulkReplace` rewrites the whole tab so
 * a retry just lands the same final state (and the `expectedModifiedTime`
 * guard further protects against lost concurrent writes).
 *
 * `append`, `updateById`, `deleteById`, `ensureTabs` are NOT in this set:
 *   - `append` would create duplicates if the first attempt actually landed
 *     in Sheets but its response was lost on the network.
 *   - `updateById`/`deleteById` are theoretically idempotent on the row state
 *     but a retry that races with a concurrent write could clobber it.
 *   - `ensureTabs` is idempotent but called once at boot, retry not critical.
 */
const RETRYABLE_OPS: ReadonlySet<string> = new Set([
  'ping', 'modifiedTime', 'modifiedTimes', 'listTabs', 'read', 'readAll', 'bulkReplace',
]);

/** Status codes worth retrying — quota throttle and server-side hiccups. */
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([408, 429, 500, 502, 503, 504]);

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableError(err: unknown): boolean {
  // `fetch` throws TypeError on network failures (ENOTFOUND, socket reset, etc.)
  if (err instanceof TypeError) return true;
  if (err instanceof SheetsApiError && typeof err.status === 'number') {
    return RETRYABLE_STATUSES.has(err.status);
  }
  return false;
}

async function call<T>(op: string, payload: Record<string, unknown> = {}): Promise<T> {
  const url = secrets.required('SHEETS_APPS_SCRIPT_URL');
  const secret = secrets.required('SHEETS_APPS_SCRIPT_SECRET');

  const canRetry = RETRYABLE_OPS.has(op);
  let lastErr: unknown;

  for (let attempt = 0; attempt <= (canRetry ? MAX_RETRIES : 0); attempt++) {
    try {
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
    } catch (err) {
      lastErr = err;
      if (!canRetry || attempt === MAX_RETRIES || !isRetryableError(err)) {
        throw err;
      }
      // Exponential back-off with jitter: 500ms, 1s, 2s (+ up to 50% random)
      const backoff = BASE_BACKOFF_MS * 2 ** attempt;
      const jitter = Math.random() * backoff * 0.5;
      const delayMs = Math.round(backoff + jitter);
      logger.warn(
        { op, attempt: attempt + 1, delayMs, err: err instanceof Error ? err.message : String(err) },
        'Sheets API call failed — retrying',
      );
      await sleep(delayMs);
    }
  }

  throw lastErr;
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

  /**
   * Per-tab last-modified timestamps (ISO). Each write op bumps only the
   * affected tab's timestamp in Apps Script's `__meta` tab, so the client
   * can rebuild only changed tabs instead of the full spreadsheet.
   *
   * Returns a map of `{ [tabName]: isoString }`. Tabs missing from the map
   * should be treated as never-tracked (rebuild defensively).
   */
  modifiedTimes(): Promise<{ modifiedTimes: Record<string, string> }> {
    return call('modifiedTimes');
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

  /**
   * Append N rows in a single round-trip. Each row's values must be in
   * column order. Use when inserting many rows at once (e.g. activity log
   * entries from a batch save) — N×500ms HTTP calls collapse into one.
   */
  bulkAppend(tab: SheetTabName, rows: SheetRow[]): Promise<{ inserted: number }> {
    const def = SHEET_TABS[tab];
    return call<{ inserted: number }>('bulkAppend', {
      tab: def.tab,
      headers: def.columns,
      rows,
    });
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

  /**
   * Replace all rows in a tab. Use sparingly — full rewrite.
   *
   * If `expectedModifiedTime` is passed, Apps Script will reject the write
   * (throwing SheetsApiError with "Conflict:" prefix) when the spreadsheet
   * was modified by another writer since that timestamp. Use this for
   * read-modify-write flows like pushBulkReplaceSlice to avoid lost updates.
   */
  bulkReplace(
    tab: SheetTabName,
    rows: SheetRow[],
    opts?: { expectedModifiedTime?: string },
  ): Promise<{ modifiedTime: string }> {
    const def = SHEET_TABS[tab];
    return call<{ modifiedTime: string }>('bulkReplace', {
      tab: def.tab,
      headers: def.columns,
      rows,
      expectedModifiedTime: opts?.expectedModifiedTime,
    });
  },
};

export { SheetsApiError };
