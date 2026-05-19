/**
 * Bootstrap the local SQLite cache from Google Sheets.
 *
 * On Vercel each lambda gets its own /tmp/cache.db. First call to `db` triggers
 * `ensureFresh()` which either:
 *   - builds the cache from scratch (cold lambda) — slow path, ~5-15s
 *   - calls Sheets modifiedTime and refreshes if stale — fast path, ~500ms
 *
 * Source of truth is the spreadsheet. This DB is read-mostly; writes go through
 * the Sheets push path in lib/db/client.ts (added in Fáza 4).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

import { sheets } from '@/lib/sheets/client';
import { rowsToObjects } from '@/lib/sheets/rows';
import { SHEET_TABS, type SheetTabName } from '@/lib/sheets/schema';
import { logger } from '@/lib/logger';
import { INIT_SCHEMA_SQL } from './init-schema';

/** Tabs in FK-dependency order — must insert parents before children. */
const TAB_LOAD_ORDER: SheetTabName[] = [
  'Store',
  'Metric',
  'Month',
  'User',
  'ImportBatch',
  'MonthlyValue',
  'DashboardNote',
  'NoteComment',
  'TaskItem',
  'ActivityEntry',
  'UserLastSeen',
  'IstAdjustmentRequest',
  'WeeklyVodOverride',
];

/** Columns that hold ISO datetime strings — coerced to Date for Prisma. */
const DATETIME_COLUMNS: ReadonlySet<string> = new Set([
  'createdAt', 'updatedAt', 'importedAt', 'lastLoginAt',
  'lastSeenAt', 'completedAt', 'decidedAt', 'emailVerified',
]);

/** Columns holding numeric values. */
const FLOAT_COLUMNS: ReadonlySet<string> = new Set([
  'value', 'oldValue', 'newValue',
]);
const INT_COLUMNS: ReadonlySet<string> = new Set([
  'year', 'monthNumber', 'businessYear', 'businessOrder',
  'rowCount', 'weekIndex', 'expires_at',
]);

const BOOL_COLUMNS: ReadonlySet<string> = new Set(['present', 'active']);

/**
 * Per-tab composite unique keys beyond the primary id column. Sheets has no
 * enforcement of these — duplicate composites with different ids can slip in
 * (botched imports, manual edits). Without this dedup, `createMany` fails on
 * Prisma's @@unique constraints and the whole cache rebuild aborts.
 *
 * Keep in sync with @@unique declarations in prisma/schema.prisma.
 */
const COMPOSITE_UNIQUE_KEYS: Partial<Record<SheetTabName, ReadonlyArray<ReadonlyArray<string>>>> = {
  MonthlyValue: [['source', 'storeId', 'metricCode', 'monthId']],
  DashboardNote: [['scopeKey', 'role', 'metricKey']],
  UserLastSeen: [['userId', 'scopeKey']],
  WeeklyVodOverride: [['storeId', 'metric', 'monthLabel', 'weekIndex']],
  User: [['email']],
};

/**
 * FK constraints to honor when filtering rows before insert. Sheets has no
 * referential integrity — a Store/Metric/Month can be deleted manually while
 * MonthlyValue rows still reference it. Prisma's SQLite connector keeps
 * `PRAGMA foreign_keys=ON`, so `createMany` would otherwise fail with P2003
 * and abort the entire rebuild.
 *
 * `required: true`  → row dropped if parent is missing
 * `required: false` → column nulled if parent is missing
 *
 * Keep in sync with @relation declarations in prisma/schema.prisma.
 */
type ForeignKeySpec = {
  column: string;
  parent: SheetTabName;
  required: boolean;
};
const FOREIGN_KEYS: Partial<Record<SheetTabName, ReadonlyArray<ForeignKeySpec>>> = {
  User: [{ column: 'primaryStoreId', parent: 'Store', required: false }],
  ImportBatch: [{ column: 'monthId', parent: 'Month', required: false }],
  MonthlyValue: [
    { column: 'storeId', parent: 'Store', required: true },
    { column: 'metricCode', parent: 'Metric', required: true },
    { column: 'monthId', parent: 'Month', required: true },
    { column: 'importBatchId', parent: 'ImportBatch', required: false },
  ],
  DashboardNote: [{ column: 'storeId', parent: 'Store', required: false }],
  IstAdjustmentRequest: [{ column: 'storeId', parent: 'Store', required: true }],
  WeeklyVodOverride: [{ column: 'storeId', parent: 'Store', required: true }],
};

type CacheMeta = {
  builtAt: string;
  /** Legacy spreadsheet-wide modifiedTime — kept for fallback diagnostics. */
  sourceModifiedTime: string | null;
  /**
   * Per-tab modifiedTime from Apps Script `__meta` tab. Lets `ensureFresh`
   * diff and rebuild only changed tabs instead of the whole spreadsheet.
   * Missing on caches built before SCHEMA_VERSION=2 — triggers full rebuild.
   */
  tabModifiedTimes?: Record<string, string>;
  schemaVersion: number;
  /** ISO timestamp of last rebuild attempt (success OR fail) — for back-off. */
  lastAttemptAt?: string;
  /** Error from last failed rebuild, if any. */
  lastError?: string;
};
const SCHEMA_VERSION = 2;

/**
 * For each parent tab, the child tabs whose FK columns reference it. If a
 * parent's modifiedTime changes (rows added/deleted/reordered), the children
 * must also be reloaded — child rows may now reference parent ids that no
 * longer exist, which the FK filter in `loadFromSheets` will catch and drop.
 *
 * Keep in sync with FOREIGN_KEYS above.
 */
const TAB_DEPENDENTS: Partial<Record<SheetTabName, ReadonlyArray<SheetTabName>>> = {
  Store: ['User', 'MonthlyValue', 'DashboardNote', 'IstAdjustmentRequest', 'WeeklyVodOverride'],
  Month: ['ImportBatch', 'MonthlyValue'],
  Metric: ['MonthlyValue'],
  ImportBatch: ['MonthlyValue'],
};

/** Prisma model accessor key per tab — single source of truth. */
const TAB_MODEL_KEY: Record<SheetTabName, keyof PrismaClient> = {
  Store: 'store',
  User: 'user',
  Metric: 'metric',
  Month: 'month',
  ImportBatch: 'importBatch',
  MonthlyValue: 'monthlyValue',
  DashboardNote: 'dashboardNote',
  NoteComment: 'noteComment',
  TaskItem: 'taskItem',
  ActivityEntry: 'activityEntry',
  UserLastSeen: 'userLastSeen',
  IstAdjustmentRequest: 'istAdjustmentRequest',
  WeeklyVodOverride: 'weeklyVodOverride',
};

/**
 * Maximum age before we re-check Sheets modifiedTime (in ms).
 *
 * Kept short to minimize the window in which two lambdas can diverge after
 * a write (each lambda has its own /tmp/cache.db, so a write through lambda
 * A is invisible to lambda B until B re-checks modifiedTime). A modifiedTime
 * round-trip is ~500ms, so 5s gives at most ~12 checks/min/lambda — well
 * within Sheets quota.
 */
const FRESHNESS_TTL_MS = 5_000;

/**
 * Minimum interval between rebuild attempts when the cache HAS been built
 * successfully at least once. Prevents request-storm cascades when a rebuild
 * fails and would otherwise trigger on every subsequent request.
 */
const REBUILD_BACKOFF_MS = 30_000;

/**
 * Shorter back-off used when the cache has NEVER been successfully built
 * (cold lambda + failed initial pull). Without this, a single transient
 * Sheets failure on cold start would make the lambda serve empty data for
 * 30 seconds — login users see "user not found" because the User table
 * has been created but is empty.
 */
const COLD_REBUILD_BACKOFF_MS = 2_000;

/**
 * In-process mutex around the wipe+insert phase of a rebuild.
 *
 * Without it, multiple concurrent requests that arrive after Sheets changed
 * would each start their own `deleteMany`/`createMany` cycle. The deletes
 * race fine, but two `createMany` calls inserting the same rows collide on
 * the composite @@unique constraints (P2002) and the second rebuild aborts
 * — leaving the cache in an inconsistent state until the back-off expires.
 *
 * Lives on `globalThis` so Next.js HMR doesn't reset it between hot reloads.
 * On Vercel each lambda has its own process so the lock is naturally per-lambda.
 */
type RebuildLockHolder = { promise: Promise<void> };
const globalForRebuildLock = globalThis as unknown as { __rebuildLock?: RebuildLockHolder };
if (!globalForRebuildLock.__rebuildLock) {
  globalForRebuildLock.__rebuildLock = { promise: Promise.resolve() };
}
const rebuildLock = globalForRebuildLock.__rebuildLock;

async function withRebuildLock<T>(work: () => Promise<T>): Promise<T> {
  const prev = rebuildLock.promise;
  let release: () => void = () => {};
  rebuildLock.promise = new Promise<void>(r => { release = r; });
  try {
    await prev;
    return await work();
  } finally {
    release();
  }
}

function getCacheDbPath(): string {
  if (process.env.VERCEL) return '/tmp/cache.db';
  // Dev/CI — colocated with Prisma
  return path.resolve(process.cwd(), 'prisma', 'dev.db');
}

function getCacheMetaPath(): string {
  if (process.env.VERCEL) return '/tmp/cache.meta.json';
  return path.resolve(process.cwd(), 'prisma', 'dev.cache.meta.json');
}

function readMeta(): CacheMeta | null {
  try {
    const raw = readFileSync(getCacheMetaPath(), 'utf-8');
    return JSON.parse(raw) as CacheMeta;
  } catch {
    return null;
  }
}

function writeMeta(meta: CacheMeta): void {
  const p = getCacheMetaPath();
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(meta, null, 2), 'utf-8');
}

function coerceValue(column: string, raw: unknown): unknown {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  if (DATETIME_COLUMNS.has(column)) {
    const d = new Date(String(raw));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (FLOAT_COLUMNS.has(column)) {
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
    return Number.isNaN(n) ? 0 : n;
  }
  if (INT_COLUMNS.has(column)) {
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    return Number.isNaN(n) ? 0 : n;
  }
  if (BOOL_COLUMNS.has(column)) {
    if (typeof raw === 'boolean') return raw;
    const s = String(raw).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return String(raw);
}

const SLOVAK_MONTH_NAMES = [
  'január', 'február', 'marec', 'apríl', 'máj', 'jún',
  'júl', 'august', 'september', 'október', 'november', 'december',
];

/** Google Sheets locale auto-converts some Slovak month names ("máj 2026", "jún 2026"...)
 *  back to dates even when we write them as text. Defensive: rebuild the label from
 *  monthNumber + year on every cache load. */
function normalizeMonthLabel(monthNumber: unknown, year: unknown, existingLabel: unknown): unknown {
  const mn = Number(monthNumber);
  const yr = Number(year);
  if (mn >= 1 && mn <= 12 && yr) {
    return `${SLOVAK_MONTH_NAMES[mn - 1]} ${yr}`;
  }
  return existingLabel;
}

function coerceRecord(tab: SheetTabName, obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of SHEET_TABS[tab].columns) {
    out[col] = coerceValue(col, obj[col]);
  }
  // Month-specific: always derive Slovak label from monthNumber+year.
  // Sheets locale would otherwise auto-convert some labels back to dates.
  if (tab === 'Month') {
    out.label = normalizeMonthLabel(out.monthNumber, out.year, out.label);
  }
  return out;
}

type ModelDelegate = {
  deleteMany: (args: { where: object }) => Promise<unknown>;
  createMany: (args: { data: object[] }) => Promise<unknown>;
  findMany: (args: { select: Record<string, true> }) => Promise<Array<Record<string, unknown>>>;
};

/** Maps tab name → Prisma model accessor on a PrismaClient instance. */
function getModelDelegate(prisma: PrismaClient, tab: SheetTabName): ModelDelegate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[TAB_MODEL_KEY[tab]];
}

/**
 * Pull all tabs from Sheets and rebuild the local SQLite cache from scratch.
 * Wipes existing rows first — destructive, only call when cache is empty/stale.
 */
/**
 * Initialize SQLite schema by executing CREATE TABLE / CREATE INDEX statements.
 * Idempotent — safe to call on cold start of Vercel lambda where /tmp/cache.db
 * is freshly created (empty file with no tables).
 *
 * Statements are split on `;\n\n` (matching the dump-schema output format).
 */
async function ensureSchemaInitialized(prisma: PrismaClient): Promise<void> {
  // Check if at least the Store table exists. If yes, schema is already there.
  const exists = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='Store'",
  );
  if (exists.length > 0) return;

  logger.info('Initializing SQLite schema from INIT_SCHEMA_SQL');
  const statements = INIT_SCHEMA_SQL.split(/;\s*\n\s*\n/).map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
  }
  logger.info({ count: statements.length }, 'Schema initialized');
}

/**
 * Wipe and reload the given tabs into the SQLite cache from Sheets.
 *
 * Shared by full rebuild (cold start) and partial rebuild (per-tab refresh).
 * Tabs are processed in FK order; parent ids needed by child tabs come from
 * this batch when the parent is being reloaded, or from the existing cache
 * otherwise.
 */
type LoadLogger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};
async function loadTabsFromSheets(
  prisma: PrismaClient,
  tabs: ReadonlyArray<SheetTabName>,
  log: LoadLogger,
): Promise<void> {
  const ordered = TAB_LOAD_ORDER.filter(t => tabs.includes(t));
  if (ordered.length === 0) return;

  const { data } = await sheets.readAll([...ordered]);

  // Wipe in reverse FK order so we don't violate FK constraints when both
  // a parent and one of its children are in this batch.
  for (const tab of [...ordered].reverse()) {
    const delegate = getModelDelegate(prisma, tab);
    await delegate.deleteMany({ where: {} });
  }

  const inBatch = new Set<SheetTabName>(ordered);
  const parentIds = new Map<SheetTabName, Set<string>>();

  // Lazily fetch the id set for a parent that's NOT in this batch (we trust
  // whatever is currently in the cache). For parents in the batch we read
  // the set built during their insert step.
  const getParentIds = async (parent: SheetTabName): Promise<Set<string>> => {
    const existing = parentIds.get(parent);
    if (existing) return existing;
    if (inBatch.has(parent)) {
      // Should have been built earlier in FK order — empty fallback is safe.
      const fallback = new Set<string>();
      parentIds.set(parent, fallback);
      return fallback;
    }
    const idCol = SHEET_TABS[parent].idColumn;
    const rows = await getModelDelegate(prisma, parent).findMany({ select: { [idCol]: true } });
    const set = new Set(rows.map(r => String(r[idCol] ?? '')).filter(Boolean));
    parentIds.set(parent, set);
    return set;
  };

  for (const tab of ordered) {
    const rows = data[tab];
    let deduped: Record<string, unknown>[] = [];

    if (rows && rows.length > 1) {
      const objects = rowsToObjects(tab, rows);
      const records = objects.map(o => coerceRecord(tab, o));

      const idCol = SHEET_TABS[tab].idColumn;
      const byId = new Map<string, Record<string, unknown>>();
      for (const r of records) {
        const k = String(r[idCol] ?? '');
        if (!k) continue;
        byId.set(k, r);
      }
      deduped = [...byId.values()];

      const compositeKeys = COMPOSITE_UNIQUE_KEYS[tab];
      if (compositeKeys?.length) {
        for (const cols of compositeKeys) {
          const seen = new Map<string, Record<string, unknown>>();
          for (const r of deduped) {
            const key = cols.map(c => String(r[c] ?? '')).join('::');
            seen.set(key, r);
          }
          deduped = [...seen.values()];
        }
      }

      const dropped = records.length - deduped.length;
      if (dropped > 0) {
        log.warn({ tab, dropped }, 'Dropped duplicate rows from Sheet before insert');
      }

      const fks = FOREIGN_KEYS[tab];
      if (fks?.length) {
        const before = deduped.length;
        const orphanCounts: Record<string, number> = {};
        const nulledCounts: Record<string, number> = {};
        const kept: Record<string, unknown>[] = [];
        for (const r of deduped) {
          let drop = false;
          for (const fk of fks) {
            const v = r[fk.column];
            if (v === null || v === undefined || v === '') continue;
            const parentSet = await getParentIds(fk.parent);
            if (parentSet.has(String(v))) continue;
            if (fk.required) {
              orphanCounts[fk.column] = (orphanCounts[fk.column] ?? 0) + 1;
              drop = true;
              break;
            }
            r[fk.column] = null;
            nulledCounts[fk.column] = (nulledCounts[fk.column] ?? 0) + 1;
          }
          if (!drop) kept.push(r);
        }
        deduped = kept;
        const orphanDropped = before - deduped.length;
        if (orphanDropped > 0) {
          log.warn({ tab, dropped: orphanDropped, byColumn: orphanCounts },
            'Dropped orphan rows with missing required FK parent');
        }
        if (Object.keys(nulledCounts).length > 0) {
          log.warn({ tab, byColumn: nulledCounts },
            'Nulled optional FK columns with missing parent');
        }
      }
    }

    const idCol = SHEET_TABS[tab].idColumn;
    const idSet = new Set<string>();
    for (const r of deduped) {
      const k = r[idCol];
      if (k !== null && k !== undefined && k !== '') idSet.add(String(k));
    }
    parentIds.set(tab, idSet);

    if (deduped.length === 0) {
      log.info({ tab }, 'Loaded tab (empty after dedup/FK filter)');
      continue;
    }

    const delegate = getModelDelegate(prisma, tab);
    await delegate.createMany({ data: deduped });
    log.debug({ tab, count: deduped.length }, 'Loaded tab');
  }
}

/**
 * Expand a set of changed tabs to include all transitive child tabs.
 *
 * If a parent's modifiedTime changed, its child rows might now reference
 * deleted parent ids — they must be reloaded so the FK filter can drop the
 * orphans. Sheets has no cascading delete.
 */
function expandWithDependents(initial: Set<SheetTabName>): Set<SheetTabName> {
  const out = new Set(initial);
  // Set iteration in JS includes items added during iteration → transitive.
  for (const tab of out) {
    const deps = TAB_DEPENDENTS[tab];
    if (!deps) continue;
    for (const d of deps) out.add(d);
  }
  return out;
}

export async function rebuildCache(prisma: PrismaClient): Promise<CacheMeta> {
  const log = logger.child({ component: 'cache-bootstrap' });
  const start = Date.now();
  log.info('Starting full cache rebuild from Sheets');

  try {
    await ensureSchemaInitialized(prisma);

    await withRebuildLock(() => loadTabsFromSheets(prisma, TAB_LOAD_ORDER, log));

    const [{ modifiedTime }, { modifiedTimes: tabTimes }] = await Promise.all([
      sheets.modifiedTime(),
      sheets.modifiedTimes(),
    ]);

    const meta: CacheMeta = {
      builtAt: new Date().toISOString(),
      sourceModifiedTime: modifiedTime,
      tabModifiedTimes: tabTimes,
      schemaVersion: SCHEMA_VERSION,
      lastAttemptAt: new Date().toISOString(),
    };
    writeMeta(meta);

    log.info({ ms: Date.now() - start, modifiedTime, tabs: TAB_LOAD_ORDER.length }, 'Full cache rebuild complete');
    return meta;
  } catch (err) {
    const prev = readMeta();
    const failureMeta: CacheMeta = {
      builtAt: prev?.builtAt ?? new Date(0).toISOString(),
      sourceModifiedTime: prev?.sourceModifiedTime ?? null,
      tabModifiedTimes: prev?.tabModifiedTimes,
      schemaVersion: SCHEMA_VERSION,
      lastAttemptAt: new Date().toISOString(),
      lastError: err instanceof Error ? err.message : String(err),
    };
    writeMeta(failureMeta);
    log.error({ err, ms: Date.now() - start }, 'Cache rebuild FAILED — will back off');
    throw err;
  }
}

/**
 * Reload only the given tabs (plus their transitive children to keep FK
 * consistency). Used when `__meta` says only a subset of tabs has changed —
 * the dominant case for end-user edits (e.g. monthly-values save bumps
 * only `MonthlyValue`).
 */
async function partialRebuild(
  prisma: PrismaClient,
  dirty: Set<SheetTabName>,
  upstreamTabTimes: Record<string, string>,
): Promise<void> {
  const log = logger.child({ component: 'cache-bootstrap' });
  const start = Date.now();

  try {
    await withRebuildLock(async () => {
      // Another caller may have rebuilt the same tabs while we were waiting
      // on the lock. Recompute the dirty set against fresh meta so we don't
      // redo the wipe+insert (and risk racing the constraint check).
      const fresh = readMeta();
      const localTimes = fresh?.tabModifiedTimes ?? {};
      const remaining = new Set<SheetTabName>();
      for (const tab of dirty) {
        if (localTimes[tab] !== upstreamTabTimes[tab]) remaining.add(tab);
      }
      if (remaining.size === 0) {
        log.info({ initialDirty: [...dirty] }, 'Partial rebuild skipped — already handled by concurrent rebuild');
        return;
      }
      const expanded = expandWithDependents(remaining);
      log.info(
        { dirtyTabs: [...remaining], reloadedTabs: [...expanded] },
        'Starting partial cache rebuild',
      );

      await loadTabsFromSheets(prisma, [...expanded], log);

      const prev = readMeta();
      const merged: Record<string, string> = { ...(prev?.tabModifiedTimes ?? {}) };
      for (const tab of expanded) {
        const t = upstreamTabTimes[tab];
        if (t) merged[tab] = t;
      }

      const meta: CacheMeta = {
        builtAt: new Date().toISOString(),
        sourceModifiedTime: prev?.sourceModifiedTime ?? null,
        tabModifiedTimes: merged,
        schemaVersion: SCHEMA_VERSION,
        lastAttemptAt: new Date().toISOString(),
      };
      writeMeta(meta);

      log.info(
        { ms: Date.now() - start, tabs: expanded.size },
        'Partial cache rebuild complete',
      );
    });
  } catch (err) {
    const prev = readMeta();
    const failureMeta: CacheMeta = {
      builtAt: prev?.builtAt ?? new Date(0).toISOString(),
      sourceModifiedTime: prev?.sourceModifiedTime ?? null,
      tabModifiedTimes: prev?.tabModifiedTimes,
      schemaVersion: SCHEMA_VERSION,
      lastAttemptAt: new Date().toISOString(),
      lastError: err instanceof Error ? err.message : String(err),
    };
    writeMeta(failureMeta);
    log.error({ err, ms: Date.now() - start }, 'Partial rebuild FAILED — will back off');
    throw err;
  }
}

/**
 * Cheap check: if cache is missing, schema bumped, or stale beyond TTL,
 * rebuild from Sheets. Otherwise no-op.
 *
 * `force: true` skips the TTL check and always re-validates against Sheets
 * (still respects the back-off). Use for endpoints serving user-generated
 * content where cross-lambda staleness causes visible flicker (notes, tasks,
 * activity).
 */
export async function ensureFresh(
  prisma: PrismaClient,
  opts?: { force?: boolean },
): Promise<void> {
  const dbPath = getCacheDbPath();
  const meta = readMeta();

  // Missing cache file or meta → cold rebuild
  if (!existsSync(dbPath) || !meta || meta.schemaVersion !== SCHEMA_VERSION) {
    await rebuildCache(prisma);
    return;
  }

  // If we have never succeeded at building the cache, sourceModifiedTime is
  // still null and the tables are empty. Use a much shorter back-off so a
  // single transient Sheets failure doesn't lock out login for 30s.
  const everBuilt = meta.sourceModifiedTime !== null;
  const backoffMs = everBuilt ? REBUILD_BACKOFF_MS : COLD_REBUILD_BACKOFF_MS;

  if (meta.lastAttemptAt) {
    const sinceAttempt = Date.now() - new Date(meta.lastAttemptAt).getTime();
    if (sinceAttempt < backoffMs) return;
  }

  // Within TTL → trust cache (unless caller forced a re-validation)
  if (!opts?.force) {
    const ageMs = Date.now() - new Date(meta.builtAt).getTime();
    if (ageMs < FRESHNESS_TTL_MS) return;
  }

  // Caches built before per-tab tracking (schemaVersion bump) get covered by
  // the version mismatch check earlier, so by here we always have
  // tabModifiedTimes available.
  const localTabTimes = meta.tabModifiedTimes ?? {};
  const { modifiedTimes: upstreamTabTimes } = await sheets.modifiedTimes();

  // Diff per tab. Tabs missing upstream are treated as unchanged — Apps Script
  // self-heals __meta on read, so missing entries only occur transiently.
  const dirty = new Set<SheetTabName>();
  for (const tab of TAB_LOAD_ORDER) {
    const remote = upstreamTabTimes[tab];
    if (!remote) continue;
    if (localTabTimes[tab] !== remote) dirty.add(tab);
  }

  if (dirty.size === 0) {
    // Nothing changed upstream — just bump local liveness markers so the
    // next caller within TTL skips the modifiedTimes round-trip.
    writeMeta({
      ...meta,
      tabModifiedTimes: { ...localTabTimes, ...upstreamTabTimes },
      builtAt: new Date().toISOString(),
      lastAttemptAt: new Date().toISOString(),
    });
    return;
  }

  await partialRebuild(prisma, dirty, upstreamTabTimes);
}

export const _testing = { getCacheDbPath, getCacheMetaPath, coerceRecord };
