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
  'ping', 'modifiedTime', 'modifiedTimes', 'listTabs', 'read', 'readAll',
  'bulkReplace', 'bulkUpsertById', 'bulkDeleteByIds',
  // `batch` is intentionally NOT here for transient-error retries: if it
  // contains a non-idempotent sub-op like `bulkAppend`, a retry after a
  // post-write network failure would duplicate those rows. Lock-busy retry
  // still applies separately (the op never ran in that case → safe).
]);

/** Status codes worth retrying — quota throttle and server-side hiccups. */
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([408, 429, 500, 502, 503, 504]);

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

/**
 * Set of ops that mutate Sheets state. After a successful write the local
 * `__metaTimes` cache below is invalidated so the next `modifiedTimes()`
 * call returns fresh data — otherwise the next `ensureFresh` would see a
 * cached pre-write snapshot and skip rebuilding the tabs we just changed.
 */
const WRITE_OPS_SET: ReadonlySet<string> = new Set([
  'ensureTabs', 'append', 'bulkAppend', 'bulkUpsertById',
  'updateById', 'deleteById', 'bulkDeleteByIds', 'bulkReplace', 'setTextFormat',
  'batch',
]);

/**
 * Per-lambda mini-cache for `modifiedTimes()`. A dashboard render fires
 * many force-validating API calls in the same second; without this, each
 * one pays ~500ms for the same upstream read. 3s window collapses them
 * into one call while keeping cross-lambda staleness bounded.
 *
 * Stored on globalThis so Next.js HMR doesn't reset it across hot reloads.
 */
type ModTimesCacheHolder = { at: number; data: Record<string, string> } | null;
const globalForModTimes = globalThis as unknown as { __modTimesCache?: ModTimesCacheHolder };
if (globalForModTimes.__modTimesCache === undefined) {
  globalForModTimes.__modTimesCache = null;
}
const MOD_TIMES_CACHE_TTL_MS = 3_000;

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

/**
 * Apps Script returns this exact string when LockService.tryLock(30000) fails.
 * The op NEVER ran server-side in this case, so retry is unconditionally safe
 * — even for non-idempotent ops like `append` (no duplicate risk).
 */
function isLockBusyError(err: unknown): boolean {
  if (!(err instanceof SheetsApiError)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('lock timeout') || msg.includes('sheets is busy');
}

async function call<T>(op: string, payload: Record<string, unknown> = {}): Promise<T> {
  const url = secrets.required('SHEETS_APPS_SCRIPT_URL');
  const secret = secrets.required('SHEETS_APPS_SCRIPT_SECRET');

  const opIsRetryable = RETRYABLE_OPS.has(op);
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const tCall = Date.now();
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
      const callMs = Date.now() - tCall;
      // Log slow calls. Apps Script normally responds 500ms-3s; anything
      // above 5s signals contention or cold-start.
      if (callMs > 1000) {
        logger.info({ op, callMs, attempt }, '[sheets] slow call');
      }
      // Successful write → invalidate the modifiedTimes mini-cache so the
      // next ensureFresh sees the upstream bump we just caused.
      if (WRITE_OPS_SET.has(op)) {
        globalForModTimes.__modTimesCache = null;
      }
      // Strip the `ok: true` field for ergonomics
      const { ok: _ok, ...rest } = data;
      return rest as T;
    } catch (err) {
      lastErr = err;

      // Lock-busy is always retryable: the op didn't actually run server-side
      // (LockService rejected before dispatch), so there's no duplicate-write
      // risk even for non-idempotent ops like `append`.
      const lockBusy = isLockBusyError(err);
      const canRetryThis = lockBusy || (opIsRetryable && isRetryableError(err));

      if (!canRetryThis || attempt === MAX_RETRIES) {
        throw err;
      }
      // Exponential back-off with jitter: 500ms, 1s, 2s (+ up to 50% random)
      const backoff = BASE_BACKOFF_MS * 2 ** attempt;
      const jitter = Math.random() * backoff * 0.5;
      const delayMs = Math.round(backoff + jitter);
      logger.warn(
        {
          op,
          attempt: attempt + 1,
          delayMs,
          reason: lockBusy ? 'lock-busy' : 'transient',
          err: err instanceof Error ? err.message : String(err),
        },
        'Sheets API call failed — retrying',
      );
      await sleep(delayMs);
    }
  }

  throw lastErr;
}

/**
 * Wire shape of one sub-op inside a `batch` request. Each variant matches
 * the payload the equivalent individual op (e.g. `bulkUpsertById`) sends to
 * Apps Script, with an extra `op` discriminator. Constructed by the
 * `pushBatch` helper in write-through.ts.
 */
export type BatchSubOpPayload =
  | { op: 'bulkUpsertById'; tab: string; idColumn: string; headers: readonly string[]; rows: SheetRow[] }
  | { op: 'bulkAppend'; tab: string; headers: readonly string[]; rows: SheetRow[] }
  | { op: 'bulkDeleteByIds'; tab: string; idColumn: string; ids: string[] }
  | { op: 'append'; tab: string; headers: readonly string[]; row: SheetRow }
  | { op: 'updateById'; tab: string; idColumn: string; id: string; row: SheetRow }
  | { op: 'deleteById'; tab: string; idColumn: string; id: string };

/** Wire shape of one sub-op result in a `batch` response. */
export type BatchSubOpResult =
  | { ok: true; tabTime: string | null; [k: string]: unknown }
  | { ok: false; error: string; index: number; op: string; tab?: string };

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
   *
   * Result is mini-cached for MOD_TIMES_CACHE_TTL_MS so that a burst of
   * `ensureFresh` calls within the same dashboard render collapses to one
   * upstream read. Cache is auto-invalidated by any write op in this client.
   */
  async modifiedTimes(): Promise<{ modifiedTimes: Record<string, string> }> {
    const cached = globalForModTimes.__modTimesCache;
    if (cached && Date.now() - cached.at < MOD_TIMES_CACHE_TTL_MS) {
      return { modifiedTimes: cached.data };
    }
    const result = await call<{ modifiedTimes: Record<string, string> }>('modifiedTimes');
    globalForModTimes.__modTimesCache = { at: Date.now(), data: result.modifiedTimes };
    return result;
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

  /**
   * Append one row. Row values must be in column order.
   * Returns the timestamp Apps Script wrote to `__meta` for this tab so
   * the caller can update its local tabModifiedTimes tracker.
   */
  append(tab: SheetTabName, row: SheetRow): Promise<{ tabTime: string | null }> {
    const def = SHEET_TABS[tab];
    return call<{ tabTime: string | null }>('append', { tab: def.tab, headers: def.columns, row });
  },

  /**
   * Append N rows in a single round-trip. Each row's values must be in
   * column order. Use when inserting many rows at once (e.g. activity log
   * entries from a batch save) — N×500ms HTTP calls collapse into one.
   */
  bulkAppend(tab: SheetTabName, rows: SheetRow[]): Promise<{ inserted: number; tabTime: string | null }> {
    const def = SHEET_TABS[tab];
    return call<{ inserted: number; tabTime: string | null }>('bulkAppend', {
      tab: def.tab,
      headers: def.columns,
      rows,
    });
  },

  /** Update row by id. Row must contain all columns in order. */
  updateById(tab: SheetTabName, id: string, row: SheetRow): Promise<{ tabTime: string | null }> {
    const def = SHEET_TABS[tab];
    return call<{ tabTime: string | null }>('updateById', { tab: def.tab, idColumn: def.idColumn, id, row });
  },

  /**
   * Upsert N rows by id in a single round-trip. Rows whose id already exists
   * get updated in place; new ids are appended. Idempotent — safe to retry.
   *
   * Drop-in replacement for `pushBulkReplaceSlice` when the write target is
   * a fixed set of (storeId, metricCode, monthId)-keyed rows: avoids the
   * full-tab read+rewrite that bulkReplaceSlice does and only touches the
   * affected rows. ~5× faster on the MonthlyValue tab.
   */
  bulkUpsertById(
    tab: SheetTabName,
    rows: SheetRow[],
  ): Promise<{ updated: number; inserted: number; tabTime: string | null }> {
    const def = SHEET_TABS[tab];
    return call<{ updated: number; inserted: number; tabTime: string | null }>('bulkUpsertById', {
      tab: def.tab,
      idColumn: def.idColumn,
      headers: def.columns,
      rows,
    });
  },

  /** Delete row by id. */
  deleteById(tab: SheetTabName, id: string): Promise<{ tabTime: string | null }> {
    const def = SHEET_TABS[tab];
    return call<{ tabTime: string | null }>('deleteById', { tab: def.tab, idColumn: def.idColumn, id });
  },

  /**
   * Delete N rows by id in a single round-trip.
   *
   * Use this for delete-slice patterns (drop rows matching some predicate)
   * when the caller can resolve the matching ids upfront from the local
   * cache — dramatically cheaper than `pushBulkReplaceSlice` for small N
   * because it doesn't rewrite the whole tab. Idempotent: missing ids are
   * silently skipped, so safe to retry.
   */
  bulkDeleteByIds(
    tab: SheetTabName,
    ids: string[],
  ): Promise<{ deleted: number; tabTime: string | null }> {
    const def = SHEET_TABS[tab];
    return call<{ deleted: number; tabTime: string | null }>('bulkDeleteByIds', {
      tab: def.tab,
      idColumn: def.idColumn,
      ids,
    });
  },

  /**
   * Replace all rows in a tab. Use sparingly — full rewrite.
   *
   * If `expectedModifiedTime` is passed, Apps Script will reject the write
   * (throwing SheetsApiError with "Conflict:" prefix) when the spreadsheet
   * was modified by another writer since that timestamp. Use this for
   * read-modify-write flows like pushBulkReplaceSlice to avoid lost updates.
   */
  /**
   * Run N sub-ops under a single LockService acquisition + HTTP round-trip.
   *
   * Each sub-op is a self-contained Apps Script call payload (the same shape
   * the individual sheets methods would send). Apps Script runs them in
   * order under one lock; if any throws, the rest are skipped. The response
   * `results` array has one entry per executed sub-op (truncated on abort).
   *
   * `pushBatch` in write-through wraps this with type-safe op constructors
   * and records local writes for each successful sub-op.
   */
  batch(ops: BatchSubOpPayload[]): Promise<{ results: BatchSubOpResult[] }> {
    return call<{ results: BatchSubOpResult[] }>('batch', { ops });
  },

  bulkReplace(
    tab: SheetTabName,
    rows: SheetRow[],
    opts?: { expectedModifiedTime?: string },
  ): Promise<{ modifiedTime: string; tabTime: string | null }> {
    const def = SHEET_TABS[tab];
    return call<{ modifiedTime: string; tabTime: string | null }>('bulkReplace', {
      tab: def.tab,
      headers: def.columns,
      rows,
      expectedModifiedTime: opts?.expectedModifiedTime,
    });
  },
};

export { SheetsApiError };
