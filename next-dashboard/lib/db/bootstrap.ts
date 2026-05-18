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

type CacheMeta = {
  builtAt: string;
  sourceModifiedTime: string | null;
  schemaVersion: number;
  /** ISO timestamp of last rebuild attempt (success OR fail) — for back-off. */
  lastAttemptAt?: string;
  /** Error from last failed rebuild, if any. */
  lastError?: string;
};
const SCHEMA_VERSION = 1;

/** Maximum age before we re-check Sheets modifiedTime (in ms). */
const FRESHNESS_TTL_MS = 60_000;

/**
 * Minimum interval between rebuild attempts. Even if Sheets has changed,
 * we won't rebuild more often than this — prevents request-storm cascades
 * when a rebuild fails and would otherwise trigger on every subsequent request.
 */
const REBUILD_BACKOFF_MS = 30_000;

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

/** Maps tab name → Prisma model accessor on a PrismaClient instance. */
function getModelDelegate(prisma: PrismaClient, tab: SheetTabName): {
  deleteMany: (args: { where: object }) => Promise<unknown>;
  createMany: (args: { data: object[] }) => Promise<unknown>;
} {
  // Prisma model names are camelCase versions of tab names
  const map: Record<SheetTabName, keyof PrismaClient> = {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[map[tab]];
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

export async function rebuildCache(prisma: PrismaClient): Promise<CacheMeta> {
  const log = logger.child({ component: 'cache-bootstrap' });
  const start = Date.now();
  log.info('Starting cache rebuild from Sheets');

  try {
    // Ensure schema exists before we touch tables (Vercel cold start case)
    await ensureSchemaInitialized(prisma);

    // Single round-trip pull
    const { data } = await sheets.readAll([...TAB_LOAD_ORDER]);
    const { modifiedTime } = await sheets.modifiedTime();

    // Wipe in reverse FK order
    for (const tab of [...TAB_LOAD_ORDER].reverse()) {
      const delegate = getModelDelegate(prisma, tab);
      await delegate.deleteMany({ where: {} });
    }

    // Insert in FK order
    for (const tab of TAB_LOAD_ORDER) {
      const rows = data[tab];
      if (!rows || rows.length <= 1) continue;

      const objects = rowsToObjects(tab, rows);
      const records = objects.map(o => coerceRecord(tab, o));

      // Defensive: dedupe by id column. If the Sheet has duplicate rows
      // (from a botched import), the last one wins and createMany doesn't
      // blow up on the unique constraint.
      const idCol = SHEET_TABS[tab].idColumn;
      const dedup = new Map<string, Record<string, unknown>>();
      for (const r of records) {
        const k = String(r[idCol] ?? '');
        if (!k) continue;
        dedup.set(k, r);
      }
      let deduped = [...dedup.values()];

      // Second-pass dedup against composite @@unique constraints. Two different
      // ids may share the same composite key (e.g. legacy duplicate MonthlyValue
      // rows for the same source/store/metric/month). Without this, createMany
      // fails on P2002.
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
      if (deduped.length === 0) continue;

      const delegate = getModelDelegate(prisma, tab);
      await delegate.createMany({ data: deduped });
      log.debug({ tab, count: deduped.length }, 'Loaded tab');
    }

    const meta: CacheMeta = {
      builtAt: new Date().toISOString(),
      sourceModifiedTime: modifiedTime,
      schemaVersion: SCHEMA_VERSION,
      lastAttemptAt: new Date().toISOString(),
    };
    writeMeta(meta);

    log.info({ ms: Date.now() - start, modifiedTime }, 'Cache rebuild complete');
    return meta;
  } catch (err) {
    // Persist failure marker so we back off instead of looping on every request.
    const prev = readMeta();
    const failureMeta: CacheMeta = {
      builtAt: prev?.builtAt ?? new Date(0).toISOString(),
      sourceModifiedTime: prev?.sourceModifiedTime ?? null,
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
 * Cheap check: if cache is missing, schema bumped, or stale beyond TTL,
 * rebuild from Sheets. Otherwise no-op.
 */
export async function ensureFresh(prisma: PrismaClient): Promise<void> {
  const dbPath = getCacheDbPath();
  const meta = readMeta();

  // Missing cache file or meta → cold rebuild
  if (!existsSync(dbPath) || !meta || meta.schemaVersion !== SCHEMA_VERSION) {
    await rebuildCache(prisma);
    return;
  }

  // Back-off: regardless of staleness, don't rebuild more often than
  // REBUILD_BACKOFF_MS. Prevents request storms from cascading rebuilds
  // when one rebuild has failed and Sheets is still ahead of cache.
  if (meta.lastAttemptAt) {
    const sinceAttempt = Date.now() - new Date(meta.lastAttemptAt).getTime();
    if (sinceAttempt < REBUILD_BACKOFF_MS) return;
  }

  // Within TTL → trust cache
  const ageMs = Date.now() - new Date(meta.builtAt).getTime();
  if (ageMs < FRESHNESS_TTL_MS) return;

  // Past TTL → check upstream
  const { modifiedTime } = await sheets.modifiedTime();
  if (modifiedTime === meta.sourceModifiedTime) {
    writeMeta({ ...meta, builtAt: new Date().toISOString(), lastAttemptAt: new Date().toISOString() });
    return;
  }

  // Upstream changed → rebuild
  await rebuildCache(prisma);
}

export const _testing = { getCacheDbPath, getCacheMetaPath, coerceRecord };
